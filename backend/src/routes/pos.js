const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { adjustStock, generateReceiptNumber, StockError } = require('../services/StockService');

const prisma = new PrismaClient();

/**
 * POST /api/pos/sale
 * Атомарная продажа: проверка + списание остатков внутри одной транзакции.
 * Поддерживает idempotencyKey для защиты от дублей.
 */
router.post('/sale', async (req, res) => {
  const { warehouseId, items, paymentMethod, amountPaid, discount, idempotencyKey, shiftId } = req.body;

  if (!warehouseId || !items || !items.length) {
    return res.status(400).json({ error: 'Не указан склад или товары' });
  }

  // Защита от дублей
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
              quantity: i.quantity,
              salePrice: i.salePrice,
              costPrice: i.costPrice || 0,
              discount: i.discount || 0,
              total: i.quantity * i.salePrice - (i.discount || 0)
            }))
          }
        },
        include: {
          items: { include: { product: true } },
          warehouse: true,
          cashier: { select: { fullName: true, login: true } }
        }
      });

      // Атомарное списание через StockService
      for (const item of items) {
        await adjustStock(tx, {
          productId: item.productId,
          warehouseId,
          delta: -item.quantity,
          type: 'sale',
          docType: 'Sale',
          docId: sale.id
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
          sku: i.product.sku,
          size: i.product.size,
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

/**
 * GET /api/pos/product/:identifier
 * Поиск по SKU или штрихкоду. Возвращает товар + все размеры этой модели.
 */
router.get('/product/:identifier', async (req, res) => {
  const { warehouseId } = req.query;
  const id = req.params.identifier;

  const product = await prisma.product.findFirst({
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

  // Все размеры этой модели на этом складе
  let siblings = [];
  if (product.modelCode && warehouseId) {
    const allSizes = await prisma.product.findMany({
      where: { modelCode: product.modelCode, isActive: true },
      include: {
        stock: { where: { warehouseId: +warehouseId } }
      }
    });
    siblings = allSizes.map(p => ({
      id: p.id,
      sku: p.sku,
      size: p.size,
      salePrice: p.salePrice,
      stockQty: p.stock[0] ? p.stock[0].quantity - (p.stock[0].reserved || 0) : 0
    }));
  }

  res.json({ ...product, stockQuantity: stockQty, siblings });
});

/**
 * GET /api/pos/sales
 * История продаж по складу
 */
router.get('/sales', async (req, res) => {
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
      items: { include: { product: true } },
      cashier: { select: { fullName: true } },
      warehouse: true
    },
    orderBy: { createdAt: 'desc' },
    take: limit ? +limit : 100
  });
  res.json(sales);
});

module.exports = router;
