const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { requireRole } = require('../middleware/auth');
const prisma = new PrismaClient();

// Открыть смену
router.post('/open', async (req, res) => {
  const { warehouseId, openingCash } = req.body;

  // Проверяем нет ли уже открытой смены
  const existing = await prisma.shift.findFirst({
    where: { warehouseId: +warehouseId, cashierId: req.user.id, status: 'open' }
  });
  if (existing) return res.status(400).json({ error: 'У вас уже есть открытая смена', shiftId: existing.id });

  const shift = await prisma.shift.create({
    data: {
      warehouseId: +warehouseId,
      cashierId: req.user.id,
      openingCash: openingCash || 0
    },
    include: { warehouse: true, cashier: { select: { fullName: true } } }
  });

  res.json(shift);
});

// Текущая открытая смена + X-отчёт (промежуточный)
router.get('/current', async (req, res) => {
  const { warehouseId } = req.query;
  const shift = await prisma.shift.findFirst({
    where: {
      cashierId: req.user.id,
      status: 'open',
      ...(warehouseId ? { warehouseId: +warehouseId } : {})
    },
    include: {
      warehouse: true,
      cashier: { select: { fullName: true } },
      sales: true,
      cashOps: true
    }
  });

  if (!shift) return res.status(404).json({ error: 'Нет открытой смены' });

  const report = buildXReport(shift);
  res.json({ shift, report });
});

// X-отчёт (промежуточный, без закрытия)
router.get('/:id/x-report', async (req, res) => {
  const shift = await prisma.shift.findUnique({
    where: { id: +req.params.id },
    include: { sales: true, cashOps: true, warehouse: true, cashier: { select: { fullName: true } } }
  });
  if (!shift) return res.status(404).json({ error: 'Смена не найдена' });

  await prisma.shift.update({ where: { id: shift.id }, data: { xReportAt: new Date() } });
  res.json(buildXReport(shift));
});

// Кассовая операция (инкассация / расход / пополнение)
router.post('/:id/cash-op', async (req, res) => {
  const { type, amount, description } = req.body;
  if (!['expense', 'collection', 'deposit'].includes(type)) {
    return res.status(400).json({ error: 'Неверный тип операции' });
  }

  const shift = await prisma.shift.findUnique({ where: { id: +req.params.id } });
  if (!shift) return res.status(404).json({ error: 'Смена не найдена' });
  if (shift.status !== 'open') return res.status(400).json({ error: 'Смена закрыта' });

  const op = await prisma.cashOperation.create({
    data: {
      shiftId: +req.params.id,
      type,
      amount: +amount,
      description,
      userId: req.user.id
    }
  });
  res.json(op);
});

// Закрыть смену (Z-отчёт)
router.post('/:id/close', async (req, res) => {
  const { closingCash } = req.body;

  const shift = await prisma.shift.findUnique({
    where: { id: +req.params.id },
    include: { sales: true, cashOps: true, warehouse: true, cashier: { select: { fullName: true } } }
  });
  if (!shift) return res.status(404).json({ error: 'Смена не найдена' });
  if (shift.status !== 'open') return res.status(400).json({ error: 'Смена уже закрыта' });

  const report = buildXReport(shift);
  const expectedCash = report.expectedCash;
  const cashDiff = (closingCash !== undefined ? closingCash : expectedCash) - expectedCash;

  const updated = await prisma.shift.update({
    where: { id: shift.id },
    data: {
      status: 'closed',
      closedAt: new Date(),
      closingCash: closingCash !== undefined ? +closingCash : null,
      expectedCash,
      cashDiff
    }
  });

  res.json({ shift: updated, report, cashDiff, zReport: true });
});

// Список смен
router.get('/', requireRole('admin', 'manager'), async (req, res) => {
  const { warehouseId } = req.query;
  const shifts = await prisma.shift.findMany({
    where: warehouseId ? { warehouseId: +warehouseId } : {},
    include: {
      cashier: { select: { fullName: true } },
      warehouse: true,
      _count: { select: { sales: true } }
    },
    orderBy: { openedAt: 'desc' },
    take: 50
  });
  res.json(shifts);
});

function buildXReport(shift) {
  const cashSales = shift.sales.filter(s => s.paymentMethod === 'cash').reduce((s, x) => s + x.total, 0);
  const cardSales = shift.sales.filter(s => s.paymentMethod === 'card').reduce((s, x) => s + x.total, 0);
  const transferSales = shift.sales.filter(s => s.paymentMethod === 'transfer').reduce((s, x) => s + x.total, 0);
  const totalSales = shift.sales.reduce((s, x) => s + x.total, 0);

  const collections = shift.cashOps.filter(o => o.type === 'collection').reduce((s, x) => s + x.amount, 0);
  const expenses = shift.cashOps.filter(o => o.type === 'expense').reduce((s, x) => s + x.amount, 0);
  const deposits = shift.cashOps.filter(o => o.type === 'deposit').reduce((s, x) => s + x.amount, 0);

  const expectedCash = shift.openingCash + cashSales - collections - expenses + deposits;

  return {
    shiftId: shift.id,
    warehouse: shift.warehouse?.name,
    cashier: shift.cashier?.fullName,
    openedAt: shift.openedAt,
    salesCount: shift.sales.length,
    cashSales,
    cardSales,
    transferSales,
    totalSales,
    collections,
    expenses,
    deposits,
    openingCash: shift.openingCash,
    expectedCash
  };
}

module.exports = router;
