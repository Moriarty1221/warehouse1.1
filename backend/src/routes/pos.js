// ============================================================
// РАЗДЕЛ 12: КАССА / POS (обновлено под ProductSize)
// ============================================================

const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { requireRole } = require('../middleware/auth');
const prisma = new PrismaClient();

router.post('/sale', requireRole('admin', 'manager', 'cashier'), async (req, res) => {
  const { warehouseId, items, paymentMethod = 'cash', amountPaid, discount = 0, shiftId, idempotencyKey } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'Не указаны товары' });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      let subtotal = 0;
      const saleItemsData = [];

      for (const item of items) {
        if (!item.sizeId) throw new Error(`Для товара ${item.productId} не выбран размер`);

        const size = await tx.productSize.findUnique({
          where: { id: item.sizeId },
          include: { product: true }
        });

        if (!size || size.quantity < item.quantity) {
          throw new Error(`Недостаточно остатка размера ${size.size} товара ${size.product.name}`);
        }

        const total = item.quantity * item.salePrice;
        subtotal += total;

        saleItemsData.push({
          productId: item.productId,
          sizeId: item.sizeId,
          quantity: item.quantity,
          salePrice: item.salePrice,
          costPrice: size.product.costPrice || 0,
          total
        });

        // Списание остатка
        await tx.productSize.update({
          where: { id: item.sizeId },
          data: { quantity: { decrement: item.quantity } }
        });
      }

      const total = subtotal - discount;
      const change = Math.max(0, (amountPaid || total) - total);

      const receiptNumber = `S${Date.now().toString().slice(-8)}`;

      const sale = await tx.sale.create({
        data: {
          receiptNumber,
          warehouseId: +warehouseId,
          cashierId: req.user.id,
          shiftId: shiftId || null,
          paymentMethod,
          subtotal,
          discount,
          total,
          amountPaid: amountPaid || total,
          change,
          idempotencyKey,
          items: { create: saleItemsData }
        },
        include: { items: { include: { product: true, size: true } }, cashier: true, warehouse: true }
      });

      return sale;
    });

    res.json({
      ok: true,
      saleId: result.id,
      receiptNumber: result.receiptNumber,
      total: result.total
    });

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Поиск товара для POS (с размерами)
router.get('/product/:sku', requireRole('admin', 'manager', 'cashier'), async (req, res) => {
  const { warehouseId } = req.query;
  const sku = req.params.sku;

  const product = await prisma.product.findUnique({
    where: { sku, isActive: true },
    include: {
      sizes: {
        where: { quantity: { gt: 0 } },
        orderBy: { size: 'asc' }
      }
    }
  });

  if (!product) return res.status(404).json({ error: 'Товар не найден' });

  const totalStock = product.sizes.reduce((sum, s) => sum + s.quantity, 0);

  res.json({
    ...product,
    totalStock,
    sizes: product.sizes.map(s => ({
      id: s.id,
      size: s.size,
      quantity: s.quantity
    }))
  });
});

router.get('/sales', requireRole('admin', 'manager', 'collector'), async (req, res) => {
  const sales = await prisma.sale.findMany({
    include: {
      items: { include: { product: true, size: true } },
      cashier: true,
      warehouse: true
    },
    orderBy: { createdAt: 'desc' },
    take: 100
  });
  res.json(sales);
});

module.exports = router;
