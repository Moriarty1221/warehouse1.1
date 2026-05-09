const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

router.get('/', async (req, res) => {
  const { warehouseId, lowStock } = req.query;
  const where = {};
  if (warehouseId) where.warehouseId = +warehouseId;
  if (lowStock === 'true') {
    where.quantity = { lte: prisma.stock.fields.quantity };
  }
  const stock = await prisma.stock.findMany({
    where,
    include: { product: { include: { category: true } }, warehouse: true },
    orderBy: { product: { name: 'asc' } }
  });

  const result = lowStock === 'true'
    ? stock.filter(s => s.quantity <= s.product.minStock)
    : stock;

  res.json(result);
});

router.get('/summary', async (req, res) => {
  const { warehouseId } = req.query;
  const where = warehouseId ? { warehouseId: +warehouseId } : {};
  const stock = await prisma.stock.findMany({
    where,
    include: { product: true, warehouse: true }
  });
  const totalItems = stock.length;
  const totalValue = stock.reduce((sum, s) => sum + s.quantity * s.avgCost, 0);
  const lowStockItems = stock.filter(s => s.quantity <= s.product.minStock).length;
  res.json({ totalItems, totalValue, lowStockItems });
});

module.exports = router;
