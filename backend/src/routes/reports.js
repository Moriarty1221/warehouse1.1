// ============================================================
// РАЗДЕЛ 8: ОТЧЁТЫ
// Файл: backend/src/routes/reports.js
// Доступ: admin, manager, collector
// ============================================================

const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { requireRole } = require('../middleware/auth');
const XLSX = require('xlsx');
const https = require('https');
const prisma = new PrismaClient();

// --- 8.1: Отчёт по остаткам ---
router.get('/stock', requireRole('admin', 'manager', 'collector', 'inventor'), async (req, res) => {
  const { warehouseId, format } = req.query;
  const where = warehouseId ? { warehouseId: +warehouseId } : {};
  const stock = await prisma.stock.findMany({
    where,
    include: { product: { include: { category: true } }, warehouse: true }
  });

  if (format === 'excel') {
    const data = stock.map(s => ({
      'Склад': s.warehouse.name,
      'SKU': s.product.sku,
      'Наименование': s.product.name,
      'Категория': s.product.category?.name || '',
      'Ед.изм.': s.product.unit,
      'Количество': s.quantity,
      'Цена продажи': s.product.price,
      'Средняя себест.': s.avgCost,
      'Сумма': s.quantity * s.avgCost,
      'Мин. остаток': s.product.minStock,
      'Статус': s.quantity <= s.product.minStock ? 'Мало' : 'OK'
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Остатки');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="stock.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.send(buf);
  }

  res.json(stock);
});

router.get('/movements', async (req, res) => {
  const { warehouseId, from, to, format } = req.query;
  const dateFilter = {};
  if (from) dateFilter.gte = new Date(from);
  if (to) dateFilter.lte = new Date(to);

  const [receipts, issues] = await Promise.all([
    prisma.receipt.findMany({
      where: { warehouseId: warehouseId ? +warehouseId : undefined, status: 'confirmed', date: Object.keys(dateFilter).length ? dateFilter : undefined },
      include: { supplier: true, warehouse: true, items: { include: { product: true } }, user: { select: { fullName: true } } }
    }),
    prisma.issue.findMany({
      where: { warehouseId: warehouseId ? +warehouseId : undefined, status: 'confirmed', date: Object.keys(dateFilter).length ? dateFilter : undefined },
      include: { warehouse: true, items: { include: { product: true } }, user: { select: { fullName: true } } }
    })
  ]);

  if (format === 'excel') {
    const rows = [];
    for (const r of receipts) {
      for (const item of r.items) {
        rows.push({ Тип: 'Приход', Дата: r.date, Склад: r.warehouse.name, Контрагент: r.supplier?.name || '', Товар: item.product.name, SKU: item.product.sku, Количество: item.quantity, Цена: item.costPerUnit, Сумма: item.quantity * item.costPerUnit, Пользователь: r.user.fullName });
      }
    }
    for (const i of issues) {
      for (const item of i.items) {
        rows.push({ Тип: 'Расход', Дата: i.date, Склад: i.warehouse.name, Контрагент: i.recipient || '', Товар: item.product.name, SKU: item.product.sku, Количество: item.quantity, Цена: '', Сумма: '', Пользователь: i.user.fullName });
      }
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Движение');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="movements.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.send(buf);
  }

  res.json({ receipts, issues });
});

router.get('/dashboard', async (req, res) => {
  const { warehouseId } = req.query;
  const wFilter = warehouseId ? { warehouseId: +warehouseId } : {};

  const [totalProducts, totalReceipts, totalIssues, stock, lowStock] = await Promise.all([
    prisma.product.count(),
    prisma.receipt.count({ where: { ...wFilter, status: 'confirmed' } }),
    prisma.issue.count({ where: { ...wFilter, status: 'confirmed' } }),
    prisma.stock.findMany({ where: wFilter, include: { product: true } }),
    prisma.stock.findMany({ where: wFilter, include: { product: true } })
  ]);

  const totalValue = stock.reduce((sum, s) => sum + s.quantity * s.avgCost, 0);
  const lowStockCount = lowStock.filter(s => s.quantity <= s.product.minStock).length;

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentReceipts = await prisma.receipt.count({ where: { ...wFilter, status: 'confirmed', date: { gte: weekAgo } } });
  const recentIssues = await prisma.issue.count({ where: { ...wFilter, status: 'confirmed', date: { gte: weekAgo } } });

  res.json({ totalProducts, totalReceipts, totalIssues, totalValue, lowStockCount, recentReceipts, recentIssues });
});

// Helper: отправить сообщение одному chat_id
async function sendToChat(BOT_TOKEN, chatId, text) {
  const payload = JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' });
  const options = {
    hostname: 'api.telegram.org',
    path: `/bot${BOT_TOKEN}/sendMessage`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
  };
  return new Promise((resolve) => {
    const req = https.request(options, (response) => {
      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', (e) => resolve({ ok: false, error: e.message }));
    req.write(payload);
    req.end();
  });
}

// Helper: отправить всем кто запустил бота (/start)
async function sendTelegramMessage(text) {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (!BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN не настроен');

  // Получаем всех подписчиков из БД
  const subscribers = await prisma.telegramSubscriber.findMany({ where: { active: true } });
  if (subscribers.length === 0) throw new Error('Нет подписчиков. Напишите /start боту.');

  const results = await Promise.all(
    subscribers.map(s => sendToChat(BOT_TOKEN, s.chatId, text))
  );
  const failed = results.filter(r => !r.ok).length;
  if (failed === results.length) throw new Error('Не удалось отправить ни одному подписчику');
  return results;
}

// Send receipt (single sale) to Telegram — called from POS after each sale
router.post('/telegram/receipt', async (req, res) => {
  const { receipt } = req.body;
  if (!receipt) return res.status(400).json({ error: 'Нет данных чека' });

  const fmt = (n) => Number(n).toFixed(2);
  const dateStr = new Date(receipt.date).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  let text = `🧾 *Кассовый чек #${receipt.id}*\n`;
  text += `🏪 ${receipt.warehouse}\n`;
  text += `📅 ${dateStr}\n`;
  text += `━━━━━━━━━━━━━━━━━\n`;
  for (const item of receipt.items) {
    text += `👟 *${item.name}*\n`;
    text += `   ${fmt(item.quantity)} ${item.unit} × ${fmt(item.price)} сом = *${fmt(item.total)} сом*\n`;
  }
  text += `━━━━━━━━━━━━━━━━━\n`;
  text += `💰 *ИТОГО: ${fmt(receipt.total)} сом*\n`;
  text += `💳 Оплата \(${receipt.paymentMethod}\): ${fmt(receipt.amountPaid)} сом\n`;
  if (receipt.change > 0) text += `🔄 Сдача: ${fmt(receipt.change)} сом\n`;
  text += `━━━━━━━━━━━━━━━━━\n`;
  text += `👤 Кассир: ${receipt.cashier}`;

  try {
    await sendTelegramMessage(text);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send daily sales report to Telegram
router.post('/telegram', async (req, res) => {
  const { warehouseId } = req.body;
  const login = req.user.login;
  const fullName = req.user.fullName;

  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  // Today range
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const wFilter = warehouseId ? { warehouseId: +warehouseId } : {};

  // Get today's confirmed issues (sales)
  const issues = await prisma.issue.findMany({
    where: { ...wFilter, status: 'confirmed', date: { gte: todayStart, lte: todayEnd } },
    include: {
      items: { include: { product: true } },
      warehouse: true
    }
  });

  // Get today's POS sales (issues with POS notes)
  const posIssues = issues.filter(i => i.notes && i.notes.includes('POS'));
  const regularIssues = issues.filter(i => !i.notes || !i.notes.includes('POS'));

  // Calculate totals from POS sales (price is stored in notes)
  let totalRevenue = 0;
  let soldItems = [];

  for (const issue of posIssues) {
    // Parse price from notes: "POS | Оплата: наличные | Сдача: X.XX"
    // Revenue = amountPaid - change, but we need to sum item prices
    for (const item of issue.items) {
      soldItems.push({ name: item.product.name, sku: item.product.sku, qty: item.quantity, price: item.product.salePrice });
      totalRevenue += item.quantity * item.product.salePrice;
    }
  }

  // Also count regular issues
  const totalIssuesCount = issues.length;
  const totalItemsSold = issues.reduce((s, i) => s + i.items.reduce((ss, it) => ss + it.quantity, 0), 0);

  // Group sold items
  const grouped = {};
  for (const item of soldItems) {
    const key = item.sku;
    if (!grouped[key]) grouped[key] = { name: item.name, qty: 0, revenue: 0 };
    grouped[key].qty += item.qty;
    grouped[key].revenue += item.qty * item.price;
  }

  const warehouseName = issues[0]?.warehouse?.name || (warehouseId ? `Склад #${warehouseId}` : 'Все склады');
  const dateStr = new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });

  let text = `📊 *Отчёт за ${dateStr}*\n`;
  text += `🏪 Склад: ${warehouseName}\n`;
  text += `👤 Отправил: ${fullName} (@${login})\n`;
  text += `─────────────────\n`;
  text += `📦 Продаж (расходов): ${totalIssuesCount}\n`;
  text += `👟 Пар продано: ${totalItemsSold}\n`;

  if (Object.keys(grouped).length > 0) {
    text += `💰 Выручка (POS): ${totalRevenue.toLocaleString('ru-RU')} сом\n`;
    text += `─────────────────\n`;
    text += `*Топ товаров:*\n`;
    const sorted = Object.values(grouped).sort((a, b) => b.qty - a.qty).slice(0, 10);
    for (const item of sorted) {
      text += `• ${item.name}: ${item.qty} пар — ${item.revenue.toLocaleString('ru-RU')} сом\n`;
    }
  } else {
    text += `─────────────────\n`;
    text += `ℹ️ Продажи через POS не найдены\n`;
  }

  text += `─────────────────\n`;
  text += `⏰ ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;

  try {
    await sendTelegramMessage(text);
    res.json({ ok: true, message: 'Отчёт отправлен в Telegram' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Продажи по размерам
router.get('/analytics/sales-by-size', async (req, res) => {
  const { warehouseId, from, to } = req.query;
  const where = { status: 'completed' };
  if (warehouseId) where.warehouseId = +warehouseId;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }

  const items = await prisma.saleItem.findMany({
    where: { sale: where },
    include: { product: { select: { size: true, brand: true, name: true, salePrice: true } }, sale: { select: { createdAt: true } } }
  });

  const bySize = {};
  for (const item of items) {
    const key = `${item.product.size || 'н/д'} | ${item.product.brand || ''}`;
    if (!bySize[key]) bySize[key] = { size: item.product.size, brand: item.product.brand, qty: 0, revenue: 0 };
    bySize[key].qty += item.quantity;
    bySize[key].revenue += item.total;
  }

  res.json(Object.values(bySize).sort((a, b) => b.qty - a.qty));
});

// Маржинальность по SKU
router.get('/analytics/margin', async (req, res) => {
  const { warehouseId, from, to } = req.query;
  const where = { status: 'completed' };
  if (warehouseId) where.warehouseId = +warehouseId;

  const items = await prisma.saleItem.findMany({
    where: { sale: where },
    include: { product: { select: { sku: true, name: true, brand: true, size: true } } }
  });

  const byProduct = {};
  for (const item of items) {
    const key = item.productId;
    if (!byProduct[key]) {
      byProduct[key] = { productId: key, sku: item.product.sku, name: item.product.name, brand: item.product.brand, size: item.product.size, qty: 0, revenue: 0, cost: 0, margin: 0 };
    }
    byProduct[key].qty += item.quantity;
    byProduct[key].revenue += item.total;
    byProduct[key].cost += item.quantity * item.costPrice;
  }

  for (const p of Object.values(byProduct)) {
    p.margin = p.revenue - p.cost;
    p.marginPct = p.revenue > 0 ? ((p.margin / p.revenue) * 100).toFixed(1) : 0;
  }

  res.json(Object.values(byProduct).sort((a, b) => b.margin - a.margin));
});

// Медленно продаваемые товары
router.get('/analytics/slow-movers', async (req, res) => {
  const { warehouseId, days } = req.query;
  const since = new Date(Date.now() - (days || 30) * 24 * 60 * 60 * 1000);

  const stock = await prisma.stock.findMany({
    where: warehouseId ? { warehouseId: +warehouseId } : {},
    include: { product: true, warehouse: true }
  });

  const sold = await prisma.saleItem.groupBy({
    by: ['productId'],
    where: { sale: { createdAt: { gte: since }, ...(warehouseId ? { warehouseId: +warehouseId } : {}) } },
    _sum: { quantity: true }
  });
  const soldMap = {};
  for (const s of sold) soldMap[s.productId] = s._sum.quantity;

  const result = stock
    .map(s => ({
      productId: s.productId,
      sku: s.product.sku,
      name: s.product.name,
      brand: s.product.brand,
      size: s.product.size,
      warehouse: s.warehouse.name,
      stockQty: s.quantity,
      soldQty: soldMap[s.productId] || 0,
      avgCost: s.avgCost,
      stockValue: s.quantity * s.avgCost
    }))
    .filter(s => s.stockQty > 0)
    .sort((a, b) => a.soldQty - b.soldQty);

  res.json(result);
});

module.exports = router;

// ============================================================
// РАЗДЕЛ 8.2: ОТЧЁТЫ В TELEGRAM ПО РОЛЯМ
// Каждый эндпоинт формирует отчёт, специфичный для роли.
// POST /reports/telegram/:role
// ============================================================

// --- 8.2.0: Вспомогательные функции ---
const fmt    = (n) => new Intl.NumberFormat('ru-RU').format(Math.round(n || 0));
const fmtDec = (n) => new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
const today  = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };
const todayEnd = () => { const d = new Date(); d.setHours(23,59,59,999); return d; };
const nowStr = () => new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Bishkek', hour: '2-digit', minute: '2-digit' });
const dateStr = () => new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });

// --- 8.2.1: АДМИНИСТРАТОР — сводный отчёт ---
router.post('/telegram/admin', requireRole('admin'), async (req, res) => {
  const { warehouseId } = req.body;
  const wf = warehouseId ? { warehouseId: +warehouseId } : {};

  const [sales, receipts, issues, stock, shifts] = await Promise.all([
    prisma.sale.findMany({
      where: { ...wf, createdAt: { gte: today(), lte: todayEnd() } },
      include: { cashier: { select: { fullName: true } } }
    }),
    prisma.receipt.count({ where: { ...wf, status: 'confirmed', date: { gte: today(), lte: todayEnd() } } }),
    prisma.issue.count({ where: { ...wf, status: 'confirmed', date: { gte: today(), lte: todayEnd() } } }),
    prisma.stock.aggregate({ _sum: { quantity: true }, where: { ...wf } }),
    prisma.shift.findMany({
      where: { ...wf, openedAt: { gte: today() } },
      include: { cashier: { select: { fullName: true } } }
    }),
  ]);

  const totalSales = sales.reduce((s, x) => s + x.total, 0);
  const cashSales  = sales.filter(s => s.paymentMethod === 'cash').reduce((s, x) => s + x.total, 0);
  const cardSales  = sales.filter(s => s.paymentMethod === 'card').reduce((s, x) => s + x.total, 0);
  const transferSales = sales.filter(s => s.paymentMethod === 'transfer').reduce((s, x) => s + x.total, 0);
  const openShifts = shifts.filter(s => s.status === 'open').length;
  const closedShifts = shifts.filter(s => s.status === 'closed').length;

  let text = `👑 *Сводный отчёт — ${dateStr()}*\n`;
  text += `👤 Администратор: ${req.user.fullName}\n`;
  text += `━━━━━━━━━━━━━━━━\n`;
  text += `🧾 Продаж: *${sales.length}* чеков\n`;
  text += `💵 Наличные: *${fmt(cashSales)} сом*\n`;
  text += `💳 Карта: *${fmt(cardSales)} сом*\n`;
  text += `🏦 Перевод: *${fmt(transferSales)} сом*\n`;
  text += `💰 Итого выручка: *${fmt(totalSales)} сом*\n`;
  text += `━━━━━━━━━━━━━━━━\n`;
  text += `📥 Приходов сегодня: ${receipts}\n`;
  text += `📤 Расходов сегодня: ${issues}\n`;
  text += `📦 Позиций на складе: ${stock._sum.quantity || 0}\n`;
  text += `━━━━━━━━━━━━━━━━\n`;
  text += `🕐 Смен открыто: ${openShifts} / закрыто: ${closedShifts}\n`;
  if (shifts.length > 0) {
    text += shifts.map(s => `  · ${s.cashier?.fullName} — ${s.status === 'open' ? '🟢 открыта' : '🔴 закрыта'}`).join('\n') + '\n';
  }
  text += `⏰ ${nowStr()}`;

  try {
    await sendTelegramMessage(text);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- 8.2.2: МЕНЕДЖЕР — складской отчёт ---
router.post('/telegram/manager', requireRole('admin', 'manager'), async (req, res) => {
  const { warehouseId } = req.body;
  const wf = warehouseId ? { warehouseId: +warehouseId } : {};

  const [sales, receipts, issues, lowStock] = await Promise.all([
    prisma.sale.findMany({
      where: { ...wf, createdAt: { gte: today(), lte: todayEnd() } }
    }),
    prisma.receipt.findMany({
      where: { ...wf, status: 'confirmed', date: { gte: today(), lte: todayEnd() } },
      include: { items: true }
    }),
    prisma.issue.findMany({
      where: { ...wf, status: 'confirmed', date: { gte: today(), lte: todayEnd() } },
      include: { items: true }
    }),
    prisma.stock.findMany({
      where: { ...wf },
      include: { product: { select: { name: true, minStock: true } } },
    }),
  ]);

  const totalSales = sales.reduce((s, x) => s + x.total, 0);
  const receiptItems = receipts.reduce((s, r) => s + r.items.reduce((ss, i) => ss + i.quantity, 0), 0);
  const issueItems = issues.reduce((s, r) => s + r.items.reduce((ss, i) => ss + i.quantity, 0), 0);
  const low = lowStock.filter(s => s.quantity <= s.product.minStock);

  let text = `📋 *Отчёт менеджера — ${dateStr()}*\n`;
  text += `👤 ${req.user.fullName}\n`;
  text += `━━━━━━━━━━━━━━━━\n`;
  text += `🛒 Продажи: *${sales.length}* чеков на *${fmt(totalSales)} сом*\n`;
  text += `━━━━━━━━━━━━━━━━\n`;
  text += `📥 Приходы: ${receipts.length} докум., ${receiptItems} ед.\n`;
  text += `📤 Расходы: ${issues.length} докум., ${issueItems} ед.\n`;
  text += `━━━━━━━━━━━━━━━━\n`;
  if (low.length > 0) {
    text += `⚠️ *Мало на складе (${low.length} позиций):*\n`;
    low.slice(0, 8).forEach(s => {
      text += `  · ${s.product.name}: ${s.quantity} ед.\n`;
    });
    if (low.length > 8) text += `  · ...и ещё ${low.length - 8} позиций\n`;
  } else {
    text += `✅ Критических остатков нет\n`;
  }
  text += `⏰ ${nowStr()}`;

  try {
    await sendTelegramMessage(text);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- 8.2.3: КАССИР — отчёт по смене ---
router.post('/telegram/cashier', requireRole('admin', 'manager', 'cashier'), async (req, res) => {
  const { warehouseId } = req.body;

  // Берём последнюю смену кассира (открытую или последнюю закрытую за сегодня)
  const shift = await prisma.shift.findFirst({
    where: {
      cashierId: req.user.id,
      ...(warehouseId ? { warehouseId: +warehouseId } : {}),
      openedAt: { gte: today() },
    },
    include: {
      warehouse: true,
      cashier: { select: { fullName: true } },
      sales: true,
      cashOps: true,
    },
    orderBy: { openedAt: 'desc' },
  });

  if (!shift) {
    return res.status(404).json({ error: 'Смена за сегодня не найдена' });
  }

  const cashSales     = shift.sales.filter(s => s.paymentMethod === 'cash').reduce((s, x) => s + x.total, 0);
  const cardSales     = shift.sales.filter(s => s.paymentMethod === 'card').reduce((s, x) => s + x.total, 0);
  const transferSales = shift.sales.filter(s => s.paymentMethod === 'transfer').reduce((s, x) => s + x.total, 0);
  const totalSales    = shift.sales.reduce((s, x) => s + x.total, 0);
  const collections   = shift.cashOps.filter(o => o.type === 'collection').reduce((s, x) => s + x.amount, 0);
  const expenses      = shift.cashOps.filter(o => o.type === 'expense').reduce((s, x) => s + x.amount, 0);
  const expectedCash  = shift.openingCash + cashSales - collections - expenses;
  const openedAt      = new Date(shift.openedAt).toLocaleTimeString('ru-RU', { timeZone: 'Asia/Bishkek', hour: '2-digit', minute: '2-digit' });

  let text = `💳 *Отчёт кассира — ${dateStr()}*\n`;
  text += `👤 ${shift.cashier?.fullName}\n`;
  text += `🏬 ${shift.warehouse?.name}\n`;
  text += `🕐 Открыта: ${openedAt} · Статус: ${shift.status === 'open' ? '🟢 открыта' : '🔴 закрыта'}\n`;
  text += `━━━━━━━━━━━━━━━━\n`;
  text += `🧾 Чеков: *${shift.sales.length}*\n`;
  text += `💵 Наличные: *${fmt(cashSales)} сом*\n`;
  text += `💳 Карта: *${fmt(cardSales)} сом*\n`;
  text += `🏦 Перевод: *${fmt(transferSales)} сом*\n`;
  text += `💰 Итого: *${fmt(totalSales)} сом*\n`;
  text += `━━━━━━━━━━━━━━━━\n`;
  text += `💼 Касса нач.: ${fmt(shift.openingCash)} сом\n`;
  if (collections > 0) text += `🏦 Инкассировано: ${fmt(collections)} сом\n`;
  if (expenses > 0) text += `📤 Расходы: ${fmt(expenses)} сом\n`;
  text += `💼 Ожидается в кассе: *${fmt(expectedCash)} сом*\n`;
  text += `⏰ ${nowStr()}`;

  try {
    await sendTelegramMessage(text);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- 8.2.4: ИНКАССАТОР — отчёт по инкассациям ---
router.post('/telegram/collector', requireRole('admin', 'collector'), async (req, res) => {
  const { warehouseId } = req.body;
  const wf = warehouseId ? { warehouseId: +warehouseId } : {};

  const shifts = await prisma.shift.findMany({
    where: { ...wf, openedAt: { gte: today() } },
    include: {
      warehouse: true,
      cashier: { select: { fullName: true } },
      sales: true,
      cashOps: true,
    },
    orderBy: { openedAt: 'desc' },
  });

  let totalCollected = 0;
  let totalSalesAll = 0;
  let lines = '';

  for (const shift of shifts) {
    const cashSales   = shift.sales.filter(s => s.paymentMethod === 'cash').reduce((s, x) => s + x.total, 0);
    const collections = shift.cashOps.filter(o => o.type === 'collection').reduce((s, x) => s + x.amount, 0);
    const totalSales  = shift.sales.reduce((s, x) => s + x.total, 0);
    totalCollected   += collections;
    totalSalesAll    += totalSales;

    lines += `\n🔹 ${shift.cashier?.fullName} (${shift.warehouse?.name})\n`;
    lines += `   Продаж: ${shift.sales.length} · Выручка: ${fmt(totalSales)} сом\n`;
    lines += `   Нал: ${fmt(cashSales)} сом · Инкассировано: ${fmt(collections)} сом\n`;
    lines += `   Статус: ${shift.status === 'open' ? '🟢 открыта' : '🔴 закрыта'}\n`;
  }

  let text = `🏦 *Отчёт инкассатора — ${dateStr()}*\n`;
  text += `👤 ${req.user.fullName}\n`;
  text += `━━━━━━━━━━━━━━━━\n`;
  text += `📊 Смен за сегодня: *${shifts.length}*\n`;
  text += `💰 Общая выручка: *${fmt(totalSalesAll)} сом*\n`;
  text += `🏦 Всего инкассировано: *${fmt(totalCollected)} сом*\n`;
  text += `━━━━━━━━━━━━━━━━`;
  text += lines || '\nНет данных за сегодня\n';
  text += `⏰ ${nowStr()}`;

  try {
    await sendTelegramMessage(text);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- 8.2.5: ИНВЕНТОР — отчёт по инвентаризациям ---
router.post('/telegram/inventor', requireRole('admin', 'manager', 'inventor'), async (req, res) => {
  const { warehouseId } = req.body;
  const wf = warehouseId ? { warehouseId: +warehouseId } : {};

  const [inventories, stock] = await Promise.all([
    prisma.inventory.findMany({
      where: { ...wf, createdAt: { gte: today() } },
      include: {
        warehouse: true,
        items: true,
        createdByUser: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.stock.findMany({
      where: { ...wf, quantity: { lte: 5 } },
      include: { product: { select: { name: true, minStock: true } } },
      take: 10,
    }),
  ]);

  let totalDiscrepancy = 0;
  let lines = '';

  for (const inv of inventories) {
    const discrepancies = inv.items.filter(i => i.actualQuantity !== null && i.actualQuantity !== i.systemQuantity);
    const diff = discrepancies.reduce((s, i) => s + (i.actualQuantity - i.systemQuantity), 0);
    totalDiscrepancy += diff;

    lines += `\n🔹 Склад: ${inv.warehouse?.name} (${inv.type})\n`;
    lines += `   Позиций: ${inv.items.length} · Расхождений: ${discrepancies.length}\n`;
    lines += `   Итого разница: ${diff >= 0 ? '+' : ''}${diff} ед.\n`;
    lines += `   Статус: ${inv.status === 'completed' ? '✅ завершена' : '🔄 в процессе'}\n`;
  }

  let text = `📦 *Отчёт инвентора — ${dateStr()}*\n`;
  text += `👤 ${req.user.fullName}\n`;
  text += `━━━━━━━━━━━━━━━━\n`;
  text += `📋 Инвентаризаций сегодня: *${inventories.length}*\n`;
  text += `📊 Суммарная разница: *${totalDiscrepancy >= 0 ? '+' : ''}${totalDiscrepancy} ед.*\n`;
  if (lines) {
    text += `━━━━━━━━━━━━━━━━`;
    text += lines;
  }
  if (stock.length > 0) {
    text += `━━━━━━━━━━━━━━━━\n`;
    text += `⚠️ *Критически мало (≤5 ед.):*\n`;
    stock.forEach(s => {
      text += `  · ${s.product.name}: ${s.quantity} ед.\n`;
    });
  }
  text += `⏰ ${nowStr()}`;

  try {
    await sendTelegramMessage(text);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
