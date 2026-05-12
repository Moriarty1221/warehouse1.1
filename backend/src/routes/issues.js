// ============================================================
// РАЗДЕЛ 5: РАСХОДЫ (СПИСАНИЯ)
// Файл: backend/src/routes/issues.js
// Доступ: admin, manager
// ============================================================

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
  const issues = await prisma.issue.findMany({
    where,
    include: { user: { select: { fullName: true } }, warehouse: true, items: { include: { product: true } } },
    orderBy: { date: 'desc' }
  });
  res.json(issues);
});

router.post('/', async (req, res) => {
  const { warehouseId, recipient, notes, items } = req.body;

  // Предварительная проверка остатков (без блокировки — для UX)
  for (const item of items) {
    const stock = await prisma.stock.findUnique({
      where: { productId_warehouseId: { productId: item.productId, warehouseId } }
    });
    if (!stock || stock.quantity < item.quantity) {
      const product = await prisma.product.findUnique({ where: { id: item.productId } });
      return res.status(400).json({ error: `Недостаточно остатков: ${product.name}` });
    }
  }

  const issue = await prisma.issue.create({
    data: {
      warehouseId, userId: req.user.id, recipient, notes,
      items: { create: items.map(i => ({ productId: i.productId, quantity: i.quantity })) }
    },
    include: { items: { include: { product: true } } }
  });
  res.json(issue);
});

// Подтверждение с транзакцией + StockService
router.post('/:id/confirm', async (req, res) => {
  const issue = await prisma.issue.findUnique({
    where: { id: +req.params.id },
    include: { items: true }
  });
  if (!issue) return res.status(404).json({ error: 'Не найдено' });
  if (issue.status !== 'draft') return res.status(400).json({ error: 'Уже подтверждено' });

  try {
    await prisma.$transaction(async (tx) => {
      for (const item of issue.items) {
        await adjustStock(tx, {
          productId: item.productId,
          warehouseId: issue.warehouseId,
          delta: -item.quantity,
          type: 'issue',
          docType: 'Issue',
          docId: issue.id
        });
      }
      await tx.issue.update({ where: { id: issue.id }, data: { status: 'confirmed' } });
      await tx.auditLog.create({
        data: { userId: req.user.id, action: 'confirm', tableName: 'issues', recordId: issue.id }
      });
    });
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof StockError) return res.status(400).json({ error: err.message, details: err.details });
    throw err;
  }
});

router.put('/:id', requireRole('admin'), async (req, res) => {
  const { notes, recipient } = req.body;
  const i = await prisma.issue.update({ where: { id: +req.params.id }, data: { notes, recipient } });
  res.json(i);
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
  const i = await prisma.issue.findUnique({ where: { id: +req.params.id }, include: { items: true } });
  if (!i) return res.status(404).json({ error: 'Не найдено' });

  if (i.status === 'confirmed') {
    await prisma.$transaction(async (tx) => {
      for (const item of i.items) {
        await adjustStock(tx, {
          productId: item.productId,
          warehouseId: i.warehouseId,
          delta: +item.quantity,
          type: 'issue',
          docType: 'Issue',
          docId: i.id
        });
      }
      await tx.issue.delete({ where: { id: +req.params.id } });
    });
  } else {
    await prisma.issue.delete({ where: { id: +req.params.id } });
  }

  res.json({ ok: true });
});

module.exports = router;
