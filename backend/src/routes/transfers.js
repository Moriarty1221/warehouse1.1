// ============================================================
// РАЗДЕЛ 10: ПЕРЕМЕЩЕНИЯ МЕЖДУ СКЛАДАМИ
// Файл: backend/src/routes/transfers.js
// Доступ: admin, manager
// ============================================================

const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { requireRole } = require('../middleware/auth');
const { adjustStock, StockError } = require('../services/StockService');

const prisma = new PrismaClient();

// Список перемещений
router.get('/', async (req, res) => {
  const { warehouseId } = req.query;
  const where = warehouseId
    ? { OR: [{ fromWarehouseId: +warehouseId }, { toWarehouseId: +warehouseId }] }
    : {};
  const transfers = await prisma.transfer.findMany({
    where,
    include: {
      fromWarehouse: true,
      toWarehouse: true,
      user: { select: { fullName: true, login: true } },
      items: { include: { product: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
  res.json(transfers);
});

// Создать черновик
router.post('/', async (req, res) => {
  const { fromWarehouseId, toWarehouseId, items, notes } = req.body;
  if (fromWarehouseId === toWarehouseId)
    return res.status(400).json({ error: 'Склад отправления и назначения совпадают' });

  const transfer = await prisma.transfer.create({
    data: {
      fromWarehouseId, toWarehouseId,
      userId: req.user.id,
      notes,
      items: { create: items.map(i => ({ productId: i.productId, sentQty: i.quantity })) }
    },
    include: {
      fromWarehouse: true, toWarehouse: true,
      items: { include: { product: true } }
    }
  });
  res.json(transfer);
});

/**
 * Отправить товар: draft → in_transit
 * Остаток списывается с источника при отправке.
 */
router.post('/:id/send', requireRole('admin', 'manager', 'warehouse'), async (req, res) => {
  const transfer = await prisma.transfer.findUnique({
    where: { id: +req.params.id },
    include: { items: true }
  });
  if (!transfer) return res.status(404).json({ error: 'Не найдено' });
  if (transfer.status !== 'draft') return res.status(400).json({ error: `Нельзя отправить: статус "${transfer.status}"` });

  try {
    await prisma.$transaction(async (tx) => {
      for (const item of transfer.items) {
        await adjustStock(tx, {
          productId: item.productId,
          warehouseId: transfer.fromWarehouseId,
          delta: -item.sentQty,
          type: 'transfer_out',
          docType: 'Transfer',
          docId: transfer.id
        });
      }
      await tx.transfer.update({
        where: { id: transfer.id },
        data: { status: 'in_transit', sentAt: new Date() }
      });
    });

    const updated = await prisma.transfer.findUnique({
      where: { id: transfer.id },
      include: { fromWarehouse: true, toWarehouse: true, items: { include: { product: true } } }
    });
    res.json(updated);
  } catch (err) {
    if (err instanceof StockError) return res.status(400).json({ error: err.message, details: err.details });
    throw err;
  }
});

/**
 * Принять товар: in_transit → received | partially_received
 * Зачисляется фактически принятое количество.
 */
router.post('/:id/receive', requireRole('admin', 'manager', 'warehouse'), async (req, res) => {
  const { receivedItems } = req.body;
  // receivedItems: [{ transferItemId, receivedQty, discrepancyNote }]

  const transfer = await prisma.transfer.findUnique({
    where: { id: +req.params.id },
    include: { items: true }
  });
  if (!transfer) return res.status(404).json({ error: 'Не найдено' });
  if (transfer.status !== 'in_transit') return res.status(400).json({ error: `Нельзя принять: статус "${transfer.status}"` });

  let hasDiscrepancy = false;

  await prisma.$transaction(async (tx) => {
    for (const recv of receivedItems) {
      const tItem = transfer.items.find(i => i.id === recv.transferItemId);
      if (!tItem) continue;

      const receivedQty = +recv.receivedQty;
      const discrepancy = receivedQty - tItem.sentQty;
      if (discrepancy !== 0) hasDiscrepancy = true;

      await tx.transferItem.update({
        where: { id: tItem.id },
        data: {
          receivedQty,
          discrepancy,
          discrepancyNote: recv.discrepancyNote || null
        }
      });

      if (receivedQty > 0) {
        await adjustStock(tx, {
          productId: tItem.productId,
          warehouseId: transfer.toWarehouseId,
          delta: receivedQty,
          type: 'transfer_in',
          docType: 'Transfer',
          docId: transfer.id
        });
      }
    }

    const newStatus = hasDiscrepancy ? 'partially_received' : 'received';
    await tx.transfer.update({
      where: { id: transfer.id },
      data: { status: newStatus, receivedAt: new Date(), confirmedBy: req.user.id }
    });
  });

  const updated = await prisma.transfer.findUnique({
    where: { id: transfer.id },
    include: { fromWarehouse: true, toWarehouse: true, items: { include: { product: true } } }
  });
  res.json(updated);
});

// Отмена (только draft)
router.post('/:id/cancel', requireRole('admin', 'manager'), async (req, res) => {
  const transfer = await prisma.transfer.findUnique({ where: { id: +req.params.id } });
  if (!transfer) return res.status(404).json({ error: 'Не найдено' });
  if (transfer.status !== 'draft') return res.status(400).json({ error: 'Можно отменить только черновик' });

  const updated = await prisma.transfer.update({
    where: { id: transfer.id },
    data: { status: 'cancelled' }
  });
  res.json(updated);
});

module.exports = router;
