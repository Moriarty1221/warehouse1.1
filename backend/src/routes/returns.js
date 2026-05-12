// ============================================================
// РАЗДЕЛ 11: ВОЗВРАТЫ
// Файл: backend/src/routes/returns.js
// Доступ: cashier, admin, manager
// ============================================================

const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { requireRole } = require('../middleware/auth');
const { adjustStock, isReturnAllowed, StockError } = require('../services/StockService');

const prisma = new PrismaClient();

// Создать возврат
router.post('/', async (req, res) => {
  const { saleId, warehouseId, reason, reasonNote, refundMethod, refundAmount, condition, items } = req.body;

  // Возврат без чека — только admin/manager
  if (!saleId && !['admin', 'manager'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Возврат без чека доступен только менеджеру или администратору' });
  }

  let sale = null;
  if (saleId) {
    sale = await prisma.sale.findUnique({ where: { id: +saleId } });
    if (!sale) return res.status(404).json({ error: 'Чек не найден' });
    if (!isReturnAllowed(sale)) {
      if (!['admin', 'manager'].includes(req.user.role)) {
        return res.status(400).json({ error: 'Прошло более 14 дней с момента продажи. Требуется одобрение менеджера.' });
      }
    }
  }

  try {
    // Ищем открытую смену кассира
    let shiftId = null;
    if (warehouseId) {
      const openShift = await prisma.shift.findFirst({
        where: { warehouseId: +warehouseId, cashierId: req.user.id, status: 'open' }
      });
      shiftId = openShift?.id || null;
    }

    const result = await prisma.$transaction(async (tx) => {
      const ret = await tx.return.create({
        data: {
          saleId: saleId ? +saleId : null,
          warehouseId: +warehouseId,
          shiftId,
          approvedBy: !saleId ? req.user.id : null,
          reason,
          reasonNote,
          refundMethod,
          refundAmount: +refundAmount,
          condition: condition || 'good',
          items: {
            create: items.map(i => ({
              productId: i.productId,
              quantity: i.quantity,
              refundPrice: i.refundPrice
            }))
          }
        },
        include: { items: { include: { product: true } } }
      });

      // Восстанавливаем остатки если товар годен
      if (condition !== 'written_off') {
        for (const item of items) {
          await adjustStock(tx, {
            productId: item.productId,
            warehouseId: +warehouseId,
            delta: +item.quantity,
            type: 'return',
            docType: 'Return',
            docId: ret.id
          });
        }
        await tx.return.update({ where: { id: ret.id }, data: { stockRestored: true } });
      }

      return ret;
    });

    res.json(result);
  } catch (err) {
    if (err instanceof StockError) return res.status(400).json({ error: err.message });
    throw err;
  }
});

// Список возвратов
router.get('/', async (req, res) => {
  const { warehouseId } = req.query;
  const returns = await prisma.return.findMany({
    where: warehouseId ? { warehouseId: +warehouseId } : {},
    include: {
      items: { include: { product: true } },
      sale: { select: { receiptNumber: true } },
      approver: { select: { fullName: true } }
    },
    orderBy: { createdAt: 'desc' },
    take: 100
  });
  res.json(returns);
});

// Детали возврата
router.get('/:id', async (req, res) => {
  const ret = await prisma.return.findUnique({
    where: { id: +req.params.id },
    include: {
      items: { include: { product: true } },
      sale: true,
      warehouse: true,
      approver: { select: { fullName: true } }
    }
  });
  if (!ret) return res.status(404).json({ error: 'Не найдено' });
  res.json(ret);
});

module.exports = router;
