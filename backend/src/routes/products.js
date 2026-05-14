// ============================================================
// РАЗДЕЛ 6: ТОВАРЫ (новая архитектура)
// ============================================================

const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { requireRole } = require('../middleware/auth');
const prisma = new PrismaClient();

const POPULAR_MODELS = [
  "GUCCI", "T10", "HERMESS КРОСС", "ADIDAS ТП", "UNCLOUD", "MIU",
  "CHANEL", "RICK OWENS", "VENETA", "NEW BALANCE", "SUPER STAR",
  "NIKE КЕДЫ 1", "NIKE КЕДЫ 2", "NIKE СЕТКА", "ADIDAS КЕДЫ", "HERMES КЕДЫ"
];

router.get('/', requireRole('admin', 'manager', 'inventor', 'cashier'), async (req, res) => {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: {
      sizes: { orderBy: { size: 'asc' } },
      category: true
    },
    orderBy: { name: 'asc' }
  });
  res.json(products);
});

router.post('/', requireRole('admin', 'manager'), async (req, res) => {
  const { sku, name, brand, salePrice = 0, costPrice = 0, sizes } = req.body;

  if (!sku || !name) return res.status(400).json({ error: 'SKU и название обязательны' });

  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.product.upsert({
      where: { sku: sku.trim().toUpperCase() },
      update: { name, brand, salePrice: +salePrice, costPrice: +costPrice },
      create: { 
        sku: sku.trim().toUpperCase(), 
        name, 
        brand, 
        salePrice: +salePrice, 
        costPrice: +costPrice 
      }
    });

    // Удаляем старые размеры и создаём новые
    await tx.productSize.deleteMany({ where: { productId: created.id } });

    if (sizes && sizes.length > 0) {
      const sizeMap = {};
      sizes.forEach(s => {
        const key = String(s.size).trim();
        if (key) sizeMap[key] = (sizeMap[key] || 0) + (+s.quantity || 0);
      });

      for (const [size, quantity] of Object.entries(sizeMap)) {
        if (quantity > 0) {
          await tx.productSize.create({
            data: { productId: created.id, size, quantity: +quantity }
          });
        }
      }
    }

    return tx.product.findUnique({
      where: { id: created.id },
      include: { sizes: true }
    });
  });

  res.json(product);
});

router.put('/:id', requireRole('admin', 'manager'), async (req, res) => {
  const { name, brand, salePrice, costPrice, sizes } = req.body;
  const id = +req.params.id;

  const product = await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id },
      data: { name, brand, salePrice: +salePrice, costPrice: +costPrice }
    });

    if (sizes) {
      await tx.productSize.deleteMany({ where: { productId: id } });

      const sizeMap = {};
      sizes.forEach(s => {
        const key = String(s.size).trim();
        if (key) sizeMap[key] = (sizeMap[key] || 0) + (+s.quantity || 0);
      });

      for (const [size, quantity] of Object.entries(sizeMap)) {
        if (quantity > 0) {
          await tx.productSize.create({ data: { productId: id, size, quantity: +quantity } });
        }
      }
    }

    return tx.product.findUnique({ where: { id }, include: { sizes: true } });
  });

  res.json(product);
});

module.exports = router;
