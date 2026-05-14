const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { requireRole } = require('../middleware/auth');
const prisma = new PrismaClient();

router.post('/', requireRole('admin', 'manager'), async (req, res) => {
  const { fromWarehouseId, toWarehouseId, notes, items } = req.body;

  const transfer = await prisma.transfer.create({
    data: {
      fromWarehouseId: +fromWarehouseId,
      toWarehouseId: +toWarehouseId,
      userId: req.user.id,
      notes,
      items: {
        create: items.map(i => ({
          productId: i.productId,
          sizeId: i.sizeId,
          sentQty: i.quantity
        }))
      }
    }
  });

  res.json(transfer);
});

router.post('/:id/confirm', requireRole('admin', 'manager'), async (req, res) => {
  const transfer = await prisma.transfer.findUnique({
    where: { id: +req.params.id },
    include: { items: true }
  });

  await prisma.$transaction(async (tx) => {
    for (const item of transfer.items) {
      // Списание с отправителя
      await tx.productSize.update({
        where: { id: item.sizeId },
        data: { quantity: { decrement: item.sentQty } }
      });

      // Приход на получателя (upsert)
      await tx.productSize.upsert({
        where: { id: item.sizeId }, // если sizeId существует
        update: { quantity: { increment: item.sentQty } },
        create: {
          productId: item.productId,
          size: (await tx.productSize.findUnique({where:{id:item.sizeId}})).size,
          quantity: item.sentQty
        }
      });
    }
    await tx.transfer.update({ where: { id: transfer.id }, data: { status: 'confirmed' } });
  });

  res.json({ ok: true });
});

module.exports = router;
