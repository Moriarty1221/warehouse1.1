// ============================================================
// РАЗДЕЛ 12: КАССА / POS
// Файл: backend/src/routes/pos.js
// Доступ:
//   POST /sale  — cashier, admin, manager
//   GET  /sales — admin, manager, collector
//   GET  /product/:id — cashier, admin, manager
// ============================================================

const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { requireRole } = require('../middleware/auth');
const { adjustStock, generateReceiptNumber, StockError } = require('../services/StockService');

const prisma = new PrismaClient();

// --- 12.1: Продажа ---
router.post('/sale', requireRole('admin', 'manager', 'cashier'), async (req, res) => {
  const { warehouseId, items, paymentMethod, amountPaid, discount, idempotencyKey, shiftId } = req.body;

  if (!warehouseId || !items || !items.length) {
    return res.status(400).json({ error: 'Не указан склад или товары' });
  }

  if (idempotencyKey) {
    const existing = await prisma.sale.findUnique({ where: { idempotencyKey } });
    if (existing) {
      return res.json({ ok: true, saleId: existing.id, receiptNumber: existing.receiptNumber, duplicate: true });
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const subtotal = items.reduce((sum, i) => sum + i.quantity * i.salePrice, 0);
      const totalDiscount = discount || 0;
      const total = subtotal - totalDiscount;
      const change = Math.max(0, (amountPaid || total) - total);

      const receiptNumber = await generateReceiptNumber(prisma, warehouseId);

      const sale = await tx.sale.create({
        data: {
          receiptNumber,
          warehouseId,
          cashierId: req.user.id,
          shiftId: shiftId || null,
          paymentMethod: paymentMethod || 'cash',
          subtotal,
          discount: totalDiscount,
          total,
          amountPaid: amountPaid || total,
          change,
          idempotencyKey: idempotencyKey || null,
          items: {
            create: items.map(i => ({
              productId: i.productId,
              sizeId: i.sizeId || null,
              quantity: i.quantity,
              salePrice: i.salePrice,
              costPrice: i.costPrice || 0,
              discount: i.discount || 0,
              total: i.quantity * i.salePrice - (i.discount || 0)
            }))
          }
        },
        include: {
          items: { include: { product: true, size: true } },
          warehouse: true,
          cashier: { select: { fullName: true, login: true } }
        }
      });

      // Списание остатков
      for (const item of items) {
        await adjustStock(tx, {
          productId: item.productId,
          warehouseId,
          delta: -item.quantity,
          type: 'sale',
          docType: 'Sale',
          docId: sale.id,
          sizeId: item.sizeId || null
        });
      }

      return sale;
    });

    res.json({
      ok: true,
      saleId: result.id,
      receiptNumber: result.receiptNumber,
      receipt: {
        id: result.id,
        receiptNumber: result.receiptNumber,
        date: result.createdAt,
        warehouse: result.warehouse.name,
        cashier: result.cashier.fullName,
        paymentMethod: result.paymentMethod,
        items: result.items.map(i => ({
          name: i.product.name,
          sku: i.size ? i.size.sku : i.product.sku,
          size: i.size ? i.size.size : i.product.size,
          brand: i.product.brand,
          quantity: i.quantity,
          unit: i.product.unit,
          price: i.salePrice,
          total: i.total
        })),
        subtotal: result.subtotal,
        discount: result.discount,
        total: result.total,
        amountPaid: result.amountPaid,
        change: result.change
      }
    });
  } catch (err) {
    if (err instanceof StockError) {
      return res.status(400).json({ error: err.message, details: err.details });
    }
    throw err;
  }
});

// --- 12.3: Поиск товара по SKU/штрихкоду ---
router.get('/product/:identifier', requireRole('admin', 'manager', 'cashier'), async (req, res) => {
  const { warehouseId } = req.query;
  const id = req.params.identifier;

  // Сначала ищем по размерному SKU
  const sizeMatch = await prisma.productSize.findFirst({
    where: { OR: [{ sku: id }, { barcode: id }] },
    include: { product: true }
  });

  let product = sizeMatch
    ? sizeMatch.product
    : await prisma.product.findFirst({
        where: { OR: [{ sku: id }, { barcode: id }], isActive: true }
      });

  if (!product) return res.status(404).json({ error: 'Товар не найден' });

  let stockQty = 0;
  if (warehouseId) {
    const s = await prisma.stock.findUnique({
      where: { productId_warehouseId: { productId: product.id, warehouseId: +warehouseId } }
    });
    stockQty = s ? s.quantity - (s.reserved || 0) : 0;
  }

  // Все размеры с остатками
  let sizes = [];
  if (product.hasMultipleSizes && warehouseId) {
    const allSizes = await prisma.productSize.findMany({
      where: { productId: product.id },
      include: {
        stock: { where: { warehouseId: +warehouseId } }
      },
      orderBy: { size: 'asc' }
    });
    sizes = allSizes.map(s => ({
      id: s.id,
      sku: s.sku,
      size: s.size,
      barcode: s.barcode,
      stockQty: s.stock[0] ? s.stock[0].quantity - (s.stock[0].reserved || 0) : 0
    }));
  }

  let siblings = [];
  if (product.modelCode && warehouseId) {
    const allSizes2 = await prisma.product.findMany({
      where: { modelCode: product.modelCode, isActive: true },
      include: { stock: { where: { warehouseId: +warehouseId } } }
    });
    siblings = allSizes2.map(p => ({
      id: p.id,
      sku: p.sku,
      size: p.size,
      salePrice: p.salePrice,
      stockQty: p.stock[0] ? p.stock[0].quantity - (p.stock[0].reserved || 0) : 0
    }));
  }

  res.json({ ...product, stockQuantity: stockQty, sizes, siblings });
});

// --- 12.2: История продаж (admin/manager/collector) ---
router.get('/sales', requireRole('admin', 'manager', 'collector'), async (req, res) => {
  const { warehouseId, from, to, limit } = req.query;
  const where = {};
  if (warehouseId) where.warehouseId = +warehouseId;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }

  const sales = await prisma.sale.findMany({
    where,
    include: {
      items: { include: { product: true, size: true } },
      cashier: { select: { fullName: true } },
      warehouse: true
    },
    orderBy: { createdAt: 'desc' },
    take: limit ? +limit : 100
  });
  res.json(sales);
});

module.exports = router;
