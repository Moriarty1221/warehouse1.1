// ============================================================
// РАЗДЕЛ 5: РАСХОДЫ (обновлено под ProductSize)
// ============================================================

const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { requireRole } = require('../middleware/auth');
const prisma = new PrismaClient();

router.post('/', requireRole('admin', 'manager'), async (req, res) => {
  const { warehouseId, recipient, notes, items } = req.body;

  const issue = await prisma.issue.create({
    data: {
      warehouseId: +warehouseId,
      userId: req.user.id,
      recipient,
      notes,
      items: {
        create: items.map(i => ({
          productId: i.productId,
          sizeId: i.sizeId,
          quantity: i.quantity
        }))
      }
    }
  });

  res.json(issue);
});

router.post('/:id/confirm', requireRole('admin', 'manager'), async (req, res) => {
  const issue = await prisma.issue.findUnique({
    where: { id: +req.params.id },
    include: { items: { include: { size: true } } }
  });

  if (!issue) return res.status(404).json({ error: 'Не найдено' });

  await prisma.$transaction(async (tx) => {
    for (const item of issue.items) {
      await tx.productSize.update({
        where: { id: item.sizeId },
        data: { quantity: { decrement: item.quantity } }
      });
    }
    await tx.issue.update({ where: { id: issue.id }, data: { status: 'confirmed' } });
  });

  res.json({ ok: true });
});

module.exports = router;
