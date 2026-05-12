// ============================================================
// РАЗДЕЛ 15: СИСТЕМНЫЕ НАСТРОЙКИ
// Файл: backend/src/routes/system.js
// Доступ: только admin
// ============================================================

const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { requireRole } = require('../middleware/auth');
const { getDiskUsagePercent, refreshDiskCache } = require('../middleware/diskMonitor');
const XLSX = require('xlsx');
const prisma = new PrismaClient();

router.get('/disk', async (req, res) => {
  const usage = getDiskUsagePercent();
  res.json({ usage, warning: usage >= 90, critical: usage >= 90, blocked: usage >= 95 });
});

router.get('/export/json', requireRole('admin', 'manager'), async (req, res) => {
  const [products, categories, suppliers, warehouses, stock, receipts, issues, users] = await Promise.all([
    prisma.product.findMany({ include: { category: true } }),
    prisma.category.findMany(),
    prisma.supplier.findMany(),
    prisma.warehouse.findMany(),
    prisma.stock.findMany({ include: { product: true, warehouse: true } }),
    prisma.receipt.findMany({ include: { items: { include: { product: true } }, supplier: true, warehouse: true } }),
    prisma.issue.findMany({ include: { items: { include: { product: true } }, warehouse: true } }),
    prisma.user.findMany({ select: { id: true, login: true, fullName: true, role: true, warehouseId: true } })
  ]);
  const data = { exportedAt: new Date().toISOString(), products, categories, suppliers, warehouses, stock, receipts, issues, users };
  res.setHeader('Content-Disposition', 'attachment; filename="warehouse_export_' + Date.now() + '.json"');
  res.setHeader('Content-Type', 'application/json');
  res.json(data);
});

router.get('/export/excel', requireRole('admin', 'manager'), async (req, res) => {
  const [products, stock, receipts, issues] = await Promise.all([
    prisma.product.findMany({ include: { category: true } }),
    prisma.stock.findMany({ include: { product: true, warehouse: true } }),
    prisma.receipt.findMany({ include: { items: { include: { product: true } }, supplier: true, warehouse: true } }),
    prisma.issue.findMany({ include: { items: { include: { product: true } }, warehouse: true } })
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
    products.map(p => ({ ID: p.id, SKU: p.sku, Наименование: p.name, Категория: p.category?.name || '', Ед: p.unit, Цена: p.price, МинОстаток: p.minStock }))
  ), 'Товары');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
    stock.map(s => ({ Склад: s.warehouse.name, SKU: s.product.sku, Товар: s.product.name, Количество: s.quantity, Цена: s.product.price, СредСебест: s.avgCost, Сумма: s.quantity * s.avgCost }))
  ), 'Остатки');
  const receiptRows = [];
  receipts.forEach(r => r.items.forEach(i => receiptRows.push({ ID: r.id, Дата: r.date, Склад: r.warehouse.name, Поставщик: r.supplier?.name || '', Товар: i.product.name, Кол: i.quantity, Цена: i.costPerUnit })));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(receiptRows.length ? receiptRows : [{ Нет: 'данных' }]), 'Приходы');
  const issueRows = [];
  issues.forEach(i => i.items.forEach(item => issueRows.push({ ID: i.id, Дата: i.date, Склад: i.warehouse.name, Получатель: i.recipient || '', Товар: item.product.name, Кол: item.quantity })));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(issueRows.length ? issueRows : [{ Нет: 'данных' }]), 'Расходы');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename="warehouse_' + Date.now() + '.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

// Full clear ALL data
router.post('/clear-all', requireRole('admin'), async (req, res) => {
  try {
    // Принудительная очистка ВСЕГО в правильном порядке FK
    await prisma.auditLog.deleteMany({});
    await prisma.inventoryItem.deleteMany({});
    await prisma.inventory.deleteMany({});
    await prisma.transferItem.deleteMany({});
    await prisma.transfer.deleteMany({});
    await prisma.issueItem.deleteMany({});
    await prisma.issue.deleteMany({});
    await prisma.receiptItem.deleteMany({});
    await prisma.receipt.deleteMany({});
    await prisma.returnItem.deleteMany({});
    await prisma.return.deleteMany({});
    await prisma.saleItem.deleteMany({});
    await prisma.sale.deleteMany({});
    await prisma.cashOperation.deleteMany({});
    await prisma.shift.deleteMany({});
    await prisma.stockMovement.deleteMany({});
    await prisma.sizeStock.deleteMany({});
    await prisma.productSize.deleteMany({});
    await prisma.stock.deleteMany({});
    await prisma.product.deleteMany({});
    await prisma.category.deleteMany({});
    await prisma.supplier.deleteMany({});
    const newUsage = refreshDiskCache();
    res.json({ ok: true, message: 'Все данные полностью удалены (принудительно)', diskUsage: newUsage });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка полной очистки: ' + err.message });
  }
});

router.post('/clear', requireRole('admin'), async (req, res) => {
  const { clearReceipts, clearIssues, clearStock, clearAudit, olderThanDays } = req.body;
  const cutoff = olderThanDays ? new Date(Date.now() - olderThanDays * 86400000) : null;
  const dateFilter = cutoff ? { date: { lt: cutoff } } : {};
  let cleared = {};
  try {
    if (clearAudit) {
      const r = await prisma.auditLog.deleteMany(cutoff ? { where: { createdAt: { lt: cutoff } } } : {});
      cleared.auditLog = r.count;
    }
    if (clearReceipts) {
      const r = await prisma.receipt.deleteMany({ where: { status: 'confirmed', ...dateFilter } });
      cleared.receipts = r.count;
    }
    if (clearIssues) {
      const r = await prisma.issue.deleteMany({ where: { status: 'confirmed', ...dateFilter } });
      cleared.issues = r.count;
    }
    if (clearStock) {
      const r = await prisma.stock.deleteMany({ where: { quantity: { lte: 0 } } });
      cleared.zeroStock = r.count;
    }
    const newUsage = refreshDiskCache();
    res.json({ ok: true, cleared, diskUsage: newUsage });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка очистки: ' + err.message });
  }
});

// Import from JSON backup
router.post('/import/json', requireRole('admin'), async (req, res) => {
  try {
    const data = req.body;
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'Неверный формат файла. Ожидается JSON-бэкап системы.' });
    }
    if (!data.products && !data.categories && !data.warehouses) {
      return res.status(400).json({ error: 'Файл не является бэкапом склада. Отсутствуют обязательные разделы.' });
    }

    const stats = { categories: 0, suppliers: 0, warehouses: 0, products: 0, stock: 0 };

    // Import categories
    if (data.categories && Array.isArray(data.categories)) {
      for (const cat of data.categories) {
        if (!cat.name) continue;
        const exists = await prisma.category.findFirst({ where: { name: cat.name } });
        if (!exists) {
          await prisma.category.create({ data: { name: cat.name } });
          stats.categories++;
        }
      }
    }

    // Import suppliers
    if (data.suppliers && Array.isArray(data.suppliers)) {
      for (const sup of data.suppliers) {
        if (!sup.name) continue;
        const exists = await prisma.supplier.findFirst({ where: { name: sup.name } });
        if (!exists) {
          await prisma.supplier.create({ data: { name: sup.name, contact: sup.contact || null, phone: sup.phone || null, email: sup.email || null } });
          stats.suppliers++;
        }
      }
    }

    // Import warehouses
    if (data.warehouses && Array.isArray(data.warehouses)) {
      for (const wh of data.warehouses) {
        if (!wh.name) continue;
        const exists = await prisma.warehouse.findFirst({ where: { name: wh.name } });
        if (!exists) {
          await prisma.warehouse.create({ data: { name: wh.name, address: wh.address || null, description: wh.description || null } });
          stats.warehouses++;
        }
      }
    }

    // Import products
    if (data.products && Array.isArray(data.products)) {
      for (const prod of data.products) {
        if (!prod.sku || !prod.name) continue;
        const exists = await prisma.product.findUnique({ where: { sku: prod.sku } });
        if (!exists) {
          let catId = null;
          if (prod.category?.name) {
            const cat = await prisma.category.findFirst({ where: { name: prod.category.name } });
            if (cat) catId = cat.id;
          }
          await prisma.product.create({
            data: { sku: prod.sku, name: prod.name, categoryId: catId, unit: prod.unit || 'шт', minStock: prod.minStock || 0, price: prod.price || 0, description: prod.description || null }
          });
          stats.products++;
        }
      }
    }

    // Import stock
    if (data.stock && Array.isArray(data.stock)) {
      for (const s of data.stock) {
        if (!s.product?.sku || !s.warehouse?.name) continue;
        const product = await prisma.product.findUnique({ where: { sku: s.product.sku } });
        const warehouse = await prisma.warehouse.findFirst({ where: { name: s.warehouse.name } });
        if (!product || !warehouse) continue;
        const exists = await prisma.stock.findUnique({ where: { productId_warehouseId: { productId: product.id, warehouseId: warehouse.id } } });
        if (!exists) {
          await prisma.stock.create({ data: { productId: product.id, warehouseId: warehouse.id, quantity: s.quantity || 0, avgCost: s.avgCost || 0 } });
          stats.stock++;
        }
      }
    }

    res.json({ ok: true, stats, message: 'Импорт завершён успешно' });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка импорта: ' + err.message });
  }
});

module.exports = router;
