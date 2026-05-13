// ============================================================
// РАЗДЕЛ 4: ПРИХОДЫ (ПОСТУПЛЕНИЯ)
// Файл: backend/src/routes/receipts.js
// ИСПРАВЛЕНО: при подтверждении обновляем SizeStock по размерам
// ============================================================

const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { requireRole } = require('../middleware/auth');
const { adjustStock, StockError } = require('../services/StockService');
const prisma = new PrismaClient();

// --- 4.1: Список приходов ---
router.get('/', requireRole('admin', 'manager'), async (req, res) => {
  const { warehouseId, status } = req.query;
  const where = {};
  if (warehouseId) where.warehouseId = +warehouseId;
  if (status) where.status = status;
  const receipts = await prisma.receipt.findMany({
    where,
    include: {
      supplier: true, warehouse: true,
      user: { select: { fullName: true } },
      items: { include: { product: { include: { sizes: true } }, size: true } }
    },
    orderBy: { date: 'desc' }
  });
  res.json(receipts);
});

// Хелпер: зачислить остатки по одной позиции прихода
// Если товар с размерами — обновляем SizeStock для каждого размера равномерно
// Если у item есть sizeId — обновляем только этот размер
async function confirmItem(tx, item, warehouseId, receiptId) {
  const product = await tx.product.findUnique({
    where: { id: item.productId },
    include: { sizes: true }
  });

  const stock = await tx.stock.findUnique({
    where: { productId_warehouseId: { productId: item.productId, warehouseId } }
  });

  let newAvgCost = item.costPerUnit;
  if (stock && stock.quantity > 0) {
    newAvgCost = (stock.quantity * stock.avgCost + item.quantity * item.costPerUnit) / (stock.quantity + item.quantity);
  }

  if (product.hasMultipleSizes && product.sizes.length > 0) {
    if (item.sizeId) {
      // Конкретный размер указан — зачисляем только на него
      await adjustStock(tx, {
        productId: item.productId, warehouseId,
        sizeId: item.sizeId,
        delta: item.quantity, type: 'receipt', docType: 'Receipt', docId: receiptId
      });
    } else {
      // Размер не указан — распределяем количество равномерно по всем размерам
      const perSize = item.quantity / product.sizes.length;
      for (const size of product.sizes) {
        await adjustStock(tx, {
          productId: item.productId, warehouseId,
          sizeId: size.id,
          delta: perSize, type: 'receipt', docType: 'Receipt', docId: receiptId
        });
      }
    }
  } else {
    // Товар без размеров — обычный Stock
    await adjustStock(tx, {
      productId: item.productId, warehouseId,
      delta: item.quantity, type: 'receipt', docType: 'Receipt', docId: receiptId
    });
  }

  // Обновляем avgCost
  try {
    await tx.stock.update({
      where: { productId_warehouseId: { productId: item.productId, warehouseId } },
      data: { avgCost: newAvgCost }
    });
  } catch {}
}

// --- 4.2: Создать приход ---
router.post('/', async (req, res) => {
  try {
    const { warehouseId, supplierId, notes, items, autoConfirm } = req.body;

    const receipt = await prisma.receipt.create({
      data: {
        warehouseId: +warehouseId,
        supplierId: supplierId || null,
        userId: req.user.id,
        notes,
        items: {
          create: items.map(i => ({
            productId: i.productId,
            sizeId: i.sizeId || null,
            quantity: i.quantity,
            costPerUnit: i.costPerUnit || 0
          }))
        }
      },
      include: { items: { include: { product: { include: { sizes: true } }, size: true } } }
    });

    if (autoConfirm) {
      try {
        await prisma.$transaction(async (tx) => {
          for (const item of receipt.items) {
            await confirmItem(tx, item, receipt.warehouseId, receipt.id);
          }
          await tx.receipt.update({ where: { id: receipt.id }, data: { status: 'confirmed' } });
        });
        return res.json({ ...receipt, status: 'confirmed', autoConfirmed: true });
      } catch (err) {
        return res.json({ ...receipt, confirmError: err.message });
      }
    }

    res.json(receipt);
  } catch (err) {
    console.error('POST /receipts error:', err);
    res.status(500).json({ error: 'Ошибка создания прихода: ' + err.message });
  }
});

// --- 4.3: Подтвердить приход ---
router.post('/:id/confirm', async (req, res) => {
  const receipt = await prisma.receipt.findUnique({
    where: { id: +req.params.id },
    include: { items: { include: { product: { include: { sizes: true } } } } }
  });
  if (!receipt) return res.status(404).json({ error: 'Не найдено' });
  if (receipt.status !== 'draft') return res.status(400).json({ error: 'Уже подтверждено' });

  try {
    await prisma.$transaction(async (tx) => {
      for (const item of receipt.items) {
        await confirmItem(tx, item, receipt.warehouseId, receipt.id);
      }
      await tx.receipt.update({ where: { id: receipt.id }, data: { status: 'confirmed' } });
    });
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof StockError) return res.status(400).json({ error: err.message });
    console.error('confirm receipt error:', err);
    res.status(500).json({ error: 'Ошибка подтверждения: ' + err.message });
  }
});

// --- 4.4: Удалить приход ---
router.delete('/:id', requireRole('admin'), async (req, res) => {
  const r = await prisma.receipt.findUnique({
    where: { id: +req.params.id },
    include: { items: { include: { product: { include: { sizes: true } } } } }
  });
  if (!r) return res.status(404).json({ error: 'Не найдено' });

  if (r.status === 'confirmed') {
    await prisma.$transaction(async (tx) => {
      for (const item of r.items) {
        if (r.product?.hasMultipleSizes && r.product?.sizes?.length > 0) {
          if (item.sizeId) {
            await adjustStock(tx, { productId: item.productId, warehouseId: r.warehouseId, sizeId: item.sizeId, delta: -item.quantity, type: 'receipt_cancel', docType: 'Receipt', docId: r.id });
          } else {
            const perSize = item.quantity / item.product.sizes.length;
            for (const size of item.product.sizes) {
              await adjustStock(tx, { productId: item.productId, warehouseId: r.warehouseId, sizeId: size.id, delta: -perSize, type: 'receipt_cancel', docType: 'Receipt', docId: r.id });
            }
          }
        } else {
          await adjustStock(tx, { productId: item.productId, warehouseId: r.warehouseId, delta: -item.quantity, type: 'receipt_cancel', docType: 'Receipt', docId: r.id });
        }
      }
      await tx.receipt.delete({ where: { id: r.id } });
    });
  } else {
    await prisma.receipt.delete({ where: { id: +req.params.id } });
  }

  res.json({ ok: true });
});

module.exports = router;
