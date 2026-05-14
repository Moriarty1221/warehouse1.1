const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { requireRole } = require('../middleware/auth');
const prisma = new PrismaClient();

router.post('/', async (req, res) => {
  const { warehouseId, supplierId, notes, items, autoConfirm } = req.body;

  const receipt = await prisma.receipt.create({
    data: {
      warehouseId: +warehouseId,
      supplierId: supplierId || null,
      userId: req.user.id,
      notes,
      items: {
        create: items.map(i => ({
          productId: i.productId,
          sizeId: i.sizeId,
          quantity: i.quantity,
          costPerUnit: i.costPerUnit || 0
        }))
      }
    },
    include: { items: { include: { product: true, size: true } } }
  });

  if (autoConfirm) {
    await prisma.$transaction(async (tx) => {
      for (const item of receipt.items) {
        await tx.productSize.upsert({
          where: { id: item.sizeId },
          update: { quantity: { increment: item.quantity } },
          create: { productId: item.productId, size: item.size.size, quantity: item.quantity } // fallback
        });
      }
      await tx.receipt.update({ where: { id: receipt.id }, data: { status: 'confirmed' } });
    });
  }

  res.json(receipt);
});

module.exports = router;
