const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { requireRole } = require('../middleware/auth');
const prisma = new PrismaClient();

const POPULAR_MODELS = [
  "GUCCI", "T10", "HERMESS КРОСС", "ADIDAS ТП", "UNCLOUD", "MIU1", "MIU2",
  "CHANEL", "RICK OWENS", "VENETA", "NEW BALANCE", "SUPER STAR",
  "NIKE КЕДЫ 1", "NIKE КЕДЫ 2", "NIKE СЕТКА", "ADIDAS КЕДЫ", "HERMES КЕДЫ"
];

// Получить все товары
router.get('/', requireRole('admin', 'manager', 'inventor', 'cashier'), async (req, res) => {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: {
      sizes: { orderBy: { size: 'asc' } },
      category: true,
      supplier: true
    },
    orderBy: { name: 'asc' }
  });
  res.json(products);
});

// Создать / обновить товар
router.post('/', requireRole('admin', 'manager'), async (req, res) => {
  const { sku, name, brand, categoryId, supplierId, salePrice, costPrice, description, sizes } = req.body;

  if (!sku || !name) return res.status(400).json({ error: 'SKU и название обязательны' });

  const product = await prisma.$transaction(async (tx) => {
    let p = await tx.product.upsert({
      where: { sku },
      update: { name, brand, categoryId: categoryId ? +categoryId : null, supplierId, salePrice: salePrice || 0, costPrice: costPrice || 0, description },
      create: { sku, name, brand, categoryId: categoryId ? +categoryId : null, supplierId, salePrice: salePrice || 0, costPrice: costPrice || 0, description }
    });

    // Обработка размеров (авто-объединение)
    if (sizes && sizes.length) {
      await tx.productSize.deleteMany({ where: { productId: p.id } });

      const sizeMap = {};
      sizes.forEach(s => {
        const key = String(s.size).trim();
        if (key) sizeMap[key] = (sizeMap[key] || 0) + (+s.quantity || 0);
      });

      for (const [size, qty] of Object.entries(sizeMap)) {
        if (qty > 0) {
          await tx.productSize.create({
            data: { productId: p.id, size, quantity: qty }
          });
        }
      }
    }

    return tx.product.findUnique({
      where: { id: p.id },
      include: { sizes: true, category: true }
    });
  });

  res.json(product);
});

module.exports = router;
