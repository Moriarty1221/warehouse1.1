// ============================================================
// РАЗДЕЛ 3: СМЕНЫ
// Файл: backend/src/routes/shifts.js
// Доступ:
//   open/close/cash-op/current/x-report — cashier, admin, manager
//   список смен                         — admin, manager, collector
// ============================================================

const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { requireRole, ROLE_GROUPS } = require('../middleware/auth');
const prisma = new PrismaClient();

// Отправка Z-отчёта в Telegram
async function sendShiftReportToTelegram(shift, report, returns) {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
  if (!BOT_TOKEN || !CHAT_ID) return false;

  const fmt = (n) => new Intl.NumberFormat('ru-RU').format(Math.round(n || 0));
  const fmtDate = (d) => d ? new Date(d).toLocaleString('ru-RU', { timeZone: 'Asia/Bishkek' }) : '—';

  const returnTotal = returns.reduce((s, r) => s + r.refundAmount, 0);
  const returnCount = returns.length;

  let text = `📊 *Отчёт по смене #${shift.id}*\n`;
  text += `🏬 Склад: ${shift.warehouse?.name || '—'}\n`;
  text += `👤 Кассир: ${shift.cashier?.fullName || '—'}\n`;
  text += `🕐 Открыта: ${fmtDate(shift.openedAt)}\n`;
  text += `🕐 Закрыта: ${fmtDate(shift.closedAt || new Date())}\n`;
  text += `━━━━━━━━━━━━━━━━\n`;
  text += `🧾 Продаж: *${report.salesCount}* чеков\n`;
  text += `💵 Наличные: *${fmt(report.cashSales)} сом*\n`;
  text += `💳 Карта: *${fmt(report.cardSales)} сом*\n`;
  text += `🏦 Перевод: *${fmt(report.transferSales)} сом*\n`;
  text += `💰 Итого продаж: *${fmt(report.totalSales)} сом*\n`;
  text += `━━━━━━━━━━━━━━━━\n`;
  if (returnCount > 0) {
    text += `↩️ Возвраты: *${returnCount}* шт. на *${fmt(returnTotal)} сом*\n`;
  } else {
    text += `↩️ Возвратов: нет\n`;
  }
  text += `━━━━━━━━━━━━━━━━\n`;
  text += `💼 Касса нач.: ${fmt(report.openingCash)} сом\n`;
  text += `💼 Касса ожид.: ${fmt(report.expectedCash)} сом\n`;
  if (shift.closingCash !== null && shift.closingCash !== undefined) {
    text += `💼 Касса факт.: ${fmt(shift.closingCash)} сом\n`;
    const diff = shift.closingCash - report.expectedCash;
    text += `${diff >= 0 ? '✅' : '⚠️'} Разница: ${diff >= 0 ? '+' : ''}${fmt(diff)} сом\n`;
  }
  text += `\n✅ Смена закрыта`;

  try {
    const resp = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'Markdown' })
      }
    );
    return resp.ok;
  } catch (e) {
    console.error('Telegram send error:', e.message);
    return false;
  }
}

// --- 3.1: Открыть смену (cashier / admin / manager) ---
router.post('/open', async (req, res) => {
  const { warehouseId, openingCash } = req.body;

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

// --- 3.2: Текущая открытая смена (cashier / admin / manager / collector) ---
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

// --- 3.3: X-отчёт (cashier / admin / manager / collector) ---
router.get('/:id/x-report', async (req, res) => {
  const shift = await prisma.shift.findUnique({
    where: { id: +req.params.id },
    include: { sales: true, cashOps: true, warehouse: true, cashier: { select: { fullName: true } } }
  });
  if (!shift) return res.status(404).json({ error: 'Смена не найдена' });

  await prisma.shift.update({ where: { id: shift.id }, data: { xReportAt: new Date() } });
  res.json(buildXReport(shift));
});

// --- 3.4: Кассовая операция (cashier / admin / manager) ---
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

// --- 3.5: Закрыть смену / Z-отчёт (cashier / admin / manager) ---
router.post('/:id/close', async (req, res) => {
  const { closingCash } = req.body;

  const shift = await prisma.shift.findUnique({
    where: { id: +req.params.id },
    include: {
      sales: true,
      cashOps: true,
      warehouse: true,
      cashier: { select: { fullName: true } }
    }
  });
  if (!shift) return res.status(404).json({ error: 'Смена не найдена' });
  if (shift.status !== 'open') return res.status(400).json({ error: 'Смена уже закрыта' });

  const report = buildXReport(shift);
  const expectedCash = report.expectedCash;
  const cashDiff = (closingCash !== undefined ? closingCash : expectedCash) - expectedCash;
  const closedAt = new Date();

  const updated = await prisma.shift.update({
    where: { id: shift.id },
    data: {
      status: 'closed',
      closedAt,
      closingCash: closingCash !== undefined ? +closingCash : null,
      expectedCash,
      cashDiff
    }
  });

  // Получаем возвраты за смену
  const returns = await prisma.return.findMany({
    where: { shiftId: shift.id }
  });

  // Отправка в Telegram сразу при закрытии
  const shiftWithClosedAt = { ...shift, ...updated, closedAt };
  const telegramOk = await sendShiftReportToTelegram(shiftWithClosedAt, report, returns);

  if (telegramOk) {
    await prisma.shift.update({ where: { id: shift.id }, data: { telegramSent: true } });
  }

  res.json({ shift: updated, report, cashDiff, zReport: true, telegramSent: telegramOk });
});

// --- 3.6: Список смен (admin / manager / collector) ---
router.get('/', requireRole('admin', 'manager', 'collector'), async (req, res) => {
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
