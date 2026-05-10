const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { requireRole } = require('../middleware/auth');
const { adjustStock, StockError } = require('../services/StockService');

const prisma = new PrismaClient();

router.get('/', async (req, res) => {
  const { warehouseId, status } = req.query;
  const where = {};
  if (warehouseId) where.warehouseId = +warehouseId;
  if (status) where.status = status;
  const receipts = await prisma.receipt.findMany({
    where,
    include: {
      supplier: true, warehouse: true,
      user: { select: { fullName: true } },
      items: { include: { product: true } }
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
      items: { create: items.map(i => ({ productId: i.productId, quantity: i.quantity, costPerUnit: i.costPerUnit || 0 })) }
    },
    include: { items: { include: { product: true } } }
  });

  // Если autoConfirm=true — сразу подтверждаем и зачисляем на остатки
  if (autoConfirm) {
    try {
      await prisma.$transaction(async (tx) => {
        for (const item of receipt.items) {
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
        }
        await tx.receipt.update({ where: { id: receipt.id }, data: { status: 'confirmed' } });
      });
      return res.json({ ...receipt, status: 'confirmed', autoConfirmed: true });
    } catch (err) {
      // Приход создан но не подтверждён — вернём как черновик
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
        const stock = await tx.stock.findUnique({
          where: { productId_warehouseId: { productId: item.productId, warehouseId: receipt.warehouseId } }
        });

        // Пересчёт средней себестоимости (AVCO)
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

        // Обновляем avgCost отдельно
        await tx.stock.update({
          where: { productId_warehouseId: { productId: item.productId, warehouseId: receipt.warehouseId } },
          data: { avgCost: newAvgCost }
        });
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
          docId: r.id
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
