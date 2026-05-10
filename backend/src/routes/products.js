const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { requireRole } = require('../middleware/auth');
const prisma = new PrismaClient();

router.get('/', async (req, res) => {
  const { categoryId, supplierId, search, modelCode, brand, size, gender, season } = req.query;
  const where = { isActive: true };
  if (categoryId) where.categoryId = +categoryId;
  if (supplierId) where.supplierId = +supplierId;
  if (modelCode) where.modelCode = modelCode;
  if (brand) where.brand = brand;
  if (size) where.size = size;
  if (gender) where.gender = gender;
  if (season) where.season = season;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { sku: { contains: search, mode: 'insensitive' } },
      { barcode: { contains: search, mode: 'insensitive' } },
      { brand: { contains: search, mode: 'insensitive' } },
      { modelCode: { contains: search, mode: 'insensitive' } }
    ];
  }

  const products = await prisma.product.findMany({
    where,
    include: {
      category: true,
      supplier: true,
      stock: { include: { warehouse: true } }
    },
    orderBy: { name: 'asc' }
  });
  res.json(products);
});

router.post('/', requireRole('admin', 'manager'), async (req, res) => {
  const { sku, barcode, name, modelCode, brand, size, gender, season,
          categoryId, supplierId, unit, minStock, costPrice, salePrice, description } = req.body;

  const product = await prisma.product.create({
    data: {
      sku, barcode: barcode || null, name,
      modelCode: modelCode || null, brand: brand || null,
      size: size || null, gender: gender || null, season: season || null,
      categoryId: categoryId || null, supplierId: supplierId || null,
      unit: unit || 'пар',
      minStock: minStock || 0,
      costPrice: costPrice || 0,
      salePrice: salePrice || 0,
      description: description || null
    },
    include: { category: true, supplier: true }
  });
  res.json(product);
});

router.put('/:id', requireRole('admin', 'manager'), async (req, res) => {
  const { sku, barcode, name, modelCode, brand, size, gender, season,
          categoryId, supplierId, unit, minStock, costPrice, salePrice, description, isActive } = req.body;

  const product = await prisma.product.update({
    where: { id: +req.params.id },
    data: {
      sku, barcode: barcode || null, name,
      modelCode: modelCode || null, brand: brand || null,
      size: size || null, gender: gender || null, season: season || null,
      categoryId: categoryId || null, supplierId: supplierId || null,
      unit, minStock, costPrice, salePrice, description,
      isActive: isActive !== undefined ? isActive : true
    },
    include: { category: true, supplier: true }
  });
  res.json(product);
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
  // Мягкое удаление
  await prisma.product.update({ where: { id: +req.params.id }, data: { isActive: false } });
  res.json({ ok: true });
});

// Получить все размеры одной модели
router.get('/model/:modelCode', async (req, res) => {
  const { warehouseId } = req.query;
  const products = await prisma.product.findMany({
    where: { modelCode: req.params.modelCode, isActive: true },
    include: {
      stock: warehouseId
        ? { where: { warehouseId: +warehouseId } }
        : true
    },
    orderBy: { size: 'asc' }
  });
  res.json(products);
});

module.exports = router;
