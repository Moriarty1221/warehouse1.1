const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { requireRole } = require('../middleware/auth');
const prisma = new PrismaClient();

router.post('/sale', requireRole('admin', 'manager', 'cashier'), async (req, res) => {
  const { items, paymentMethod = 'cash', amountPaid, discount = 0, shiftId } = req.body;

  if (!items?.length) return res.status(400).json({ error: 'Нет товаров' });

  try {
    const sale = await prisma.$transaction(async (tx) => {
      let subtotal = 0;
      const saleItems = [];

      for (const item of items) {
        if (!item.sizeId) throw new Error('Не выбран размер');

        const sizeRecord = await tx.productSize.findUnique({
          where: { id: item.sizeId },
          include: { product: true }
        });

        if (!sizeRecord || sizeRecord.quantity < item.quantity) {
          throw new Error(`Недостаточно товара ${sizeRecord.product.name} размер ${sizeRecord.size}`);
        }

        const total = item.quantity * item.salePrice;
        subtotal += total;

        saleItems.push({
          productId: sizeRecord.productId,
          sizeId: item.sizeId,
          quantity: item.quantity,
          salePrice: item.salePrice,
          costPrice: sizeRecord.product.costPrice || 0,
          total
        });

        // Списание
        await tx.productSize.update({
          where: { id: item.sizeId },
          data: { quantity: { decrement: item.quantity } }
        });
      }

      const totalAmount = subtotal - discount;
      const receiptNumber = `S${Date.now().toString().slice(-8)}`;

      return await tx.sale.create({
        data: {
          receiptNumber,
          warehouseId: req.body.warehouseId,
          cashierId: req.user.id,
          shiftId,
          paymentMethod,
          subtotal,
          discount,
          total: totalAmount,
          amountPaid: amountPaid || totalAmount,
          change: Math.max(0, (amountPaid || totalAmount) - totalAmount),
          items: { create: saleItems }
        },
        include: { items: { include: { product: true, size: true } } }
      });
    });

    res.json({ ok: true, sale, receiptNumber: sale.receiptNumber });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/product/:sku', requireRole('admin', 'manager', 'cashier'), async (req, res) => {
  const product = await prisma.product.findUnique({
    where: { sku: req.params.sku.toUpperCase() },
    include: { sizes: { where: { quantity: { gt: 0 } }, orderBy: { size: 'asc' } } }
  });

  if (!product) return res.status(404).json({ error: 'Товар не найден' });

  res.json({
    ...product,
    totalStock: product.sizes.reduce((sum, s) => sum + s.quantity, 0)
  });
});

module.exports = router;
