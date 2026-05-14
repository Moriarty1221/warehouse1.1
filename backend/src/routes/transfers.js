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
    include: { items: { include: { size: true } } }
  });

  if (!transfer) return res.status(404).json({ error: 'Перемещение не найдено' });
  if (transfer.status !== 'draft') return res.status(400).json({ error: 'Уже подтверждено' });

  await prisma.$transaction(async (tx) => {
    for (const item of transfer.items) {
      // Списание с отправителя (ProductSize.quantity отражает остаток на складе-источнике)
      await tx.productSize.update({
        where: { id: item.sizeId },
        data: { quantity: { decrement: item.sentQty } }
      });

      // Приход на склад получателя — ищем или создаём ProductSize для целевого склада.
      // ProductSize в данной схеме не привязан к складу напрямую,
      // поэтому используем SizeStock для учёта остатков по складам.
      await tx.sizeStock.upsert({
        where: {
          sizeId_warehouseId: {
            sizeId: item.sizeId,
            warehouseId: transfer.toWarehouseId
          }
        },
        update: { quantity: { increment: item.sentQty } },
        create: {
          sizeId: item.sizeId,
          warehouseId: transfer.toWarehouseId,
          quantity: item.sentQty
        }
      });

      // Уменьшаем остаток на складе-отправителе в SizeStock
      await tx.sizeStock.upsert({
        where: {
          sizeId_warehouseId: {
            sizeId: item.sizeId,
            warehouseId: transfer.fromWarehouseId
          }
        },
        update: { quantity: { decrement: item.sentQty } },
        create: {
          sizeId: item.sizeId,
          warehouseId: transfer.fromWarehouseId,
          quantity: 0
        }
      });
    }

    await tx.transfer.update({
      where: { id: transfer.id },
      data: { status: 'confirmed' }
    });
  });

  res.json({ ok: true });
});

module.exports = router;
