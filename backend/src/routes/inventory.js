// ============================================================
// РАЗДЕЛ 9: ИНВЕНТАРИЗАЦИЯ
// Файл: backend/src/routes/inventory.js
// Доступ: admin, manager, inventor
// ============================================================

const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { requireRole } = require('../middleware/auth');
const { adjustStock } = require('../services/StockService');

const prisma = new PrismaClient();

// Создать инвентаризацию
router.post('/', requireRole('admin', 'manager', 'inventor'), async (req, res) => {
  const { warehouseId, type, scope } = req.body;

  // Получаем текущие остатки
  const where = { warehouseId: +warehouseId };
  if (scope && scope.startsWith('category:')) {
    const catId = +scope.split(':')[1];
    where.product = { categoryId: catId };
  }

  const stocks = await prisma.stock.findMany({
    where,
    include: { product: true }
  });

  const inventory = await prisma.inventory.create({
    data: {
      warehouseId: +warehouseId,
      type: type || 'full',
      scope: scope || null,
      createdBy: req.user.id,
      items: {
        create: stocks.map(s => ({
          productId: s.productId,
          expectedQty: s.quantity
        }))
      }
    },
    include: { items: { include: { product: true } } }
  });

  res.json(inventory);
});

// Начать инвентаризацию (draft → in_progress)
router.post('/:id/start', requireRole('admin', 'manager', 'inventor'), async (req, res) => {
  const inv = await prisma.inventory.findUnique({ where: { id: +req.params.id } });
  if (!inv) return res.status(404).json({ error: 'Не найдено' });
  if (inv.status !== 'draft') return res.status(400).json({ error: 'Уже запущена или завершена' });

  const updated = await prisma.inventory.update({
    where: { id: inv.id },
    data: { status: 'in_progress', startedAt: new Date() }
  });
  res.json(updated);
});

// Сканировать товар (обновить actualQty)
router.post('/:id/scan', requireRole('admin', 'manager', 'inventor'), async (req, res) => {
  const { barcode, sku, quantity } = req.body;

  const product = await prisma.product.findFirst({
    where: barcode ? { barcode } : { sku }
  });
  if (!product) return res.status(404).json({ error: 'Товар не найден' });

  const invItem = await prisma.inventoryItem.findFirst({
    where: { inventoryId: +req.params.id, productId: product.id }
  });
  if (!invItem) return res.status(404).json({ error: 'Товар не в списке инвентаризации' });

  const actualQty = quantity !== undefined ? +quantity : (invItem.actualQty || 0) + 1;

  const updated = await prisma.inventoryItem.update({
    where: { id: invItem.id },
    data: { actualQty },
    include: { product: true }
  });
  res.json(updated);
});

// Завершить и применить результаты
router.post('/:id/complete', requireRole('admin', 'manager', 'inventor'), async (req, res) => {
  const inv = await prisma.inventory.findUnique({
    where: { id: +req.params.id },
    include: { items: true }
  });
  if (!inv) return res.status(404).json({ error: 'Не найдено' });
  if (inv.status !== 'in_progress') return res.status(400).json({ error: 'Инвентаризация не в процессе' });

  await prisma.$transaction(async (tx) => {
    for (const item of inv.items) {
      const actual = item.actualQty ?? item.expectedQty;
      const discrepancy = actual - item.expectedQty;
      const action = discrepancy < 0 ? 'write_off' : discrepancy > 0 ? 'surplus' : null;

      await tx.inventoryItem.update({
        where: { id: item.id },
        data: { actualQty: actual, discrepancy, action }
      });

      if (discrepancy !== 0) {
        await adjustStock(tx, {
          productId: item.productId,
          warehouseId: inv.warehouseId,
          delta: discrepancy,
          type: 'inventory_adj',
          docType: 'Inventory',
          docId: inv.id
        });
      }
    }

    await tx.inventory.update({
      where: { id: inv.id },
      data: { status: 'completed', completedAt: new Date() }
    });
  });

  const updated = await prisma.inventory.findUnique({
    where: { id: inv.id },
    include: { items: { include: { product: true } } }
  });
  res.json(updated);
});

// Список инвентаризаций
router.get('/', async (req, res) => {
  const { warehouseId } = req.query;
  const inventories = await prisma.inventory.findMany({
    where: warehouseId ? { warehouseId: +warehouseId } : {},
    include: { warehouse: true, _count: { select: { items: true } } },
    orderBy: { id: 'desc' },
    take: 50
  });
  res.json(inventories);
});

// Детали
router.get('/:id', async (req, res) => {
  const inv = await prisma.inventory.findUnique({
    where: { id: +req.params.id },
    include: { items: { include: { product: true } }, warehouse: true }
  });
  if (!inv) return res.status(404).json({ error: 'Не найдено' });
  res.json(inv);
});

module.exports = router;
