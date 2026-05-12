// ============================================================
// РАЗДЕЛ 4: ПРИХОДЫ (ПОСТУПЛЕНИЯ)
// Файл: backend/src/routes/receipts.js
// Доступ: admin, manager
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
      items: { include: { product: true, size: true } }
    },
    orderBy: { date: 'desc' }
  });
  res.json(receipts);
});

router.post('/', async (req, res) => {
  const { warehouseId, supplierId, notes, items, autoConfirm } = req.body;
  const receipt = await prisma.receipt.create({
    data: {
      warehouseId, supplierId: supplierId || null,
      userId: req.user.id, notes,
      items: {
        create: items.map(i => ({
          productId: i.productId,
          sizeId: i.sizeId || null,      // <-- сохраняем sizeId
          quantity: i.quantity,
          costPerUnit: i.costPerUnit || 0
        }))
      }
    },
    include: { items: { include: { product: true, size: true } } }
  });

  if (autoConfirm) {
    try {
      await prisma.$transaction(async (tx) => {
        for (const item of receipt.items) {
          if (!item.sizeId) {
            // Обычный товар без размерной сетки
            const stock = await tx.stock.findUnique({
              where: { productId_warehouseId: { productId: item.productId, warehouseId: receipt.warehouseId } }
            });
            let newAvgCost = item.costPerUnit;
            if (stock && stock.quantity > 0) {
              newAvgCost = (stock.quantity * stock.avgCost + item.quantity * item.costPerUnit) / (stock.quantity + item.quantity);
            }
            await adjustStock(tx, {
              productId: item.productId, warehouseId: receipt.warehouseId,
              delta: item.quantity, type: 'receipt', docType: 'Receipt', docId: receipt.id
            });
            await tx.stock.update({
              where: { productId_warehouseId: { productId: item.productId, warehouseId: receipt.warehouseId } },
              data: { avgCost: newAvgCost }
            });
          } else {
            // Товар с размерами — зачисляем в SizeStock + пересчитываем суммарный Stock
            await adjustStock(tx, {
              productId: item.productId, warehouseId: receipt.warehouseId,
              delta: item.quantity, type: 'receipt', docType: 'Receipt', docId: receipt.id,
              sizeId: item.sizeId
            });
            // avgCost на уровне модели
            const stock = await tx.stock.findUnique({
              where: { productId_warehouseId: { productId: item.productId, warehouseId: receipt.warehouseId } }
            });
            if (stock && stock.quantity > 0) {
              const prevQty = stock.quantity - item.quantity;
              const newAvgCost = prevQty > 0
                ? (stock.avgCost * prevQty + item.quantity * item.costPerUnit) / stock.quantity
                : item.costPerUnit;
              await tx.stock.update({
                where: { productId_warehouseId: { productId: item.productId, warehouseId: receipt.warehouseId } },
                data: { avgCost: newAvgCost }
              });
            }
          }
        }
        await tx.receipt.update({ where: { id: receipt.id }, data: { status: 'confirmed' } });
      });
      return res.json({ ...receipt, status: 'confirmed', autoConfirmed: true });
    } catch (err) {
      return res.json({ ...receipt, confirmError: err.message });
    }
  }

  res.json(receipt);
});

router.post('/:id/confirm', async (req, res) => {
  const receipt = await prisma.receipt.findUnique({
    where: { id: +req.params.id },
    include: { items: true }
  });
  if (!receipt) return res.status(404).json({ error: 'Не найдено' });
  if (receipt.status !== 'draft') return res.status(400).json({ error: 'Уже подтверждено' });

  try {
    await prisma.$transaction(async (tx) => {
      for (const item of receipt.items) {
        if (!item.sizeId) {
          // Обычный товар
          const stock = await tx.stock.findUnique({
            where: { productId_warehouseId: { productId: item.productId, warehouseId: receipt.warehouseId } }
          });
          let newAvgCost = item.costPerUnit;
          if (stock && stock.quantity > 0) {
            newAvgCost = (stock.quantity * stock.avgCost + item.quantity * item.costPerUnit) / (stock.quantity + item.quantity);
          }
          await adjustStock(tx, {
            productId: item.productId,
            warehouseId: receipt.warehouseId,
            delta: item.quantity,
            type: 'receipt',
            docType: 'Receipt',
            docId: receipt.id
          });
          await tx.stock.update({
            where: { productId_warehouseId: { productId: item.productId, warehouseId: receipt.warehouseId } },
            data: { avgCost: newAvgCost }
          });
        } else {
          // Товар с размером — зачисляем в SizeStock
          await adjustStock(tx, {
            productId: item.productId,
            warehouseId: receipt.warehouseId,
            delta: item.quantity,
            type: 'receipt',
            docType: 'Receipt',
            docId: receipt.id,
            sizeId: item.sizeId   // <-- передаём sizeId
          });
          const stock = await tx.stock.findUnique({
            where: { productId_warehouseId: { productId: item.productId, warehouseId: receipt.warehouseId } }
          });
          if (stock && stock.quantity > 0) {
            const prevQty = stock.quantity - item.quantity;
            const newAvgCost = prevQty > 0
              ? (stock.avgCost * prevQty + item.quantity * item.costPerUnit) / stock.quantity
              : item.costPerUnit;
            await tx.stock.update({
              where: { productId_warehouseId: { productId: item.productId, warehouseId: receipt.warehouseId } },
              data: { avgCost: newAvgCost }
            });
          }
        }
      }
      await tx.receipt.update({ where: { id: receipt.id }, data: { status: 'confirmed' } });
    });

    res.json({ ok: true });
  } catch (err) {
    if (err instanceof StockError) return res.status(400).json({ error: err.message });
    throw err;
  }
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
  const r = await prisma.receipt.findUnique({ where: { id: +req.params.id }, include: { items: true } });
  if (!r) return res.status(404).json({ error: 'Не найдено' });

  if (r.status === 'confirmed') {
    await prisma.$transaction(async (tx) => {
      for (const item of r.items) {
        await adjustStock(tx, {
          productId: item.productId,
          warehouseId: r.warehouseId,
          delta: -item.quantity,
          type: 'receipt',
          docType: 'Receipt',
          docId: r.id,
          sizeId: item.sizeId || null   // <-- тоже передаём при откате
        });
      }
      await tx.receipt.delete({ where: { id: +req.params.id } });
    });
  } else {
    await prisma.receipt.delete({ where: { id: +req.params.id } });
  }

  res.json({ ok: true });
});

module.exports = router;
