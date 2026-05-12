// ============================================================
// РАЗДЕЛ 6: ТОВАРЫ
// Файл: backend/src/routes/products.js
// Доступ:
//   GET (просмотр) — admin, manager, inventor
//   POST/PUT/DELETE — admin, manager
// ============================================================

const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { requireRole } = require('../middleware/auth');
const prisma = new PrismaClient();

// --- 6.1: Список товаров (admin/manager/inventor) ---
router.get('/', requireRole('admin', 'manager', 'inventor', 'cashier'), async (req, res) => {
  const { categoryId, supplierId, search, modelCode, brand, size, gender, season } = req.query;
  const where = { isActive: true };
  if (categoryId) where.categoryId = +categoryId;
  if (supplierId) where.supplierId = +supplierId;
  if (modelCode) where.modelCode = modelCode;
  if (brand) where.brand = brand;
  if (gender) where.gender = gender;
  if (season) where.season = season;
  // size фильтр: если hasMultipleSizes — ищем внутри sizes, иначе product.size
  if (size) {
    where.OR = [
      { size: size },
      { sizes: { some: { size } } }
    ];
  }
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { sku: { contains: search, mode: 'insensitive' } },
      { barcode: { contains: search, mode: 'insensitive' } },
      { brand: { contains: search, mode: 'insensitive' } },
      { modelCode: { contains: search, mode: 'insensitive' } },
      { sizes: { some: { sku: { contains: search, mode: 'insensitive' } } } },
    ];
  }

  const products = await prisma.product.findMany({
    where,
    include: {
      category: true,
      supplier: true,
      stock: { include: { warehouse: true } },
      sizes: {
        include: {
          stock: true
        },
        orderBy: { size: 'asc' }
      }
    },
    orderBy: { name: 'asc' }
  });
  res.json(products);
});

// POST /products — создать товар (с возможностью передать sizes[])
router.post('/', requireRole('admin', 'manager'), async (req, res) => {
  const { sku, barcode, name, modelCode, brand, size, gender, season,
          categoryId, supplierId, unit, minStock, costPrice, salePrice,
          description, sizes } = req.body;

  // Если передан массив sizes — создаём товар с размерами (hasMultipleSizes=true)
  if (sizes && sizes.length > 0) {
    // Базовый SKU модели
    const baseModelSku = sku?.trim() ||
      `${(modelCode||brand||'PROD').toUpperCase().replace(/\s+/g,'').slice(0,10)}-MULTI`;

    // ИСПРАВЛЕНО: генерируем уникальный SKU для каждого размера автоматически
    // Штрихкод (barcode) может быть одинаковым для всех размеров одной модели
    const sizeSkuCount = {};
    const sizesData = sizes.map(s => {
      const sizeKey = String(s.size).toUpperCase().replace(/\s+/g, '');
      sizeSkuCount[sizeKey] = (sizeSkuCount[sizeKey] || 0) + 1;
      const suffix = sizeSkuCount[sizeKey] > 1 ? `-${sizeSkuCount[sizeKey]}` : '';
      const autoSku = `${(modelCode||brand||'PROD').toUpperCase().replace(/\s+/g,'').slice(0,8)}-${sizeKey}${suffix}`;
      return {
        size: s.size,
        sku: s.sku?.trim() || autoSku,
        barcode: s.barcode?.trim() || barcode || null  // используем общий barcode модели если не задан
      };
    });

    const product = await prisma.product.create({
      data: {
        sku: baseModelSku,
        barcode: barcode || null,
        name,
        modelCode: modelCode || null,
        brand: brand || null,
        gender: gender || null,
        season: season || null,
        categoryId: categoryId ? +categoryId : null,
        supplierId: supplierId ? +supplierId : null,
        unit: unit || 'пар',
        minStock: minStock ? +minStock : 0,
        costPrice: costPrice ? +costPrice : 0,
        salePrice: salePrice ? +salePrice : 0,
        description: description || null,
        hasMultipleSizes: true,
        sizes: { create: sizesData }
      },
      include: { category: true, supplier: true, sizes: true }
    });
    return res.json(product);
  }

  // Одиночный товар без размерной сетки
  const product = await prisma.product.create({
    data: {
      sku, barcode: barcode || null, name,
      modelCode: modelCode || null, brand: brand || null,
      size: size || null, gender: gender || null, season: season || null,
      categoryId: categoryId ? +categoryId : null, supplierId: supplierId ? +supplierId : null,
      unit: unit || 'пар',
      minStock: minStock ? +minStock : 0,
      costPrice: costPrice ? +costPrice : 0,
      salePrice: salePrice ? +salePrice : 0,
      description: description || null,
      hasMultipleSizes: false
    },
    include: { category: true, supplier: true, sizes: true }
  });
  res.json(product);
});

// PUT /products/:id — обновить товар
router.put('/:id', requireRole('admin', 'manager'), async (req, res) => {
  const { sku, barcode, name, modelCode, brand, size, gender, season,
          categoryId, supplierId, unit, minStock, costPrice, salePrice,
          description, isActive, sizes } = req.body;

  const product = await prisma.product.update({
    where: { id: +req.params.id },
    data: {
      sku, barcode: barcode || null, name,
      modelCode: modelCode || null, brand: brand || null,
      size: size || null, gender: gender || null, season: season || null,
      categoryId: categoryId ? +categoryId : null,
      supplierId: supplierId ? +supplierId : null,
      unit, minStock: +minStock, costPrice: +costPrice, salePrice: +salePrice,
      description,
      isActive: isActive !== undefined ? isActive : true
    },
    include: { category: true, supplier: true, sizes: { include: { stock: true } } }
  });
  res.json(product);
});

// DELETE /products/:id
router.delete('/:id', requireRole('admin'), async (req, res) => {
  await prisma.product.update({ where: { id: +req.params.id }, data: { isActive: false } });
  res.json({ ok: true });
});

// GET /products/model/:modelCode
router.get('/model/:modelCode', async (req, res) => {
  const { warehouseId } = req.query;
  const products = await prisma.product.findMany({
    where: { modelCode: req.params.modelCode, isActive: true },
    include: {
      sizes: {
        include: {
          stock: warehouseId ? { where: { warehouseId: +warehouseId } } : true
        }
      },
      stock: warehouseId
        ? { where: { warehouseId: +warehouseId } }
        : true
    },
    orderBy: { size: 'asc' }
  });
  res.json(products);
});

// GET /products/:id/sizes — получить размеры конкретного товара
router.get('/:id/sizes', async (req, res) => {
  const { warehouseId } = req.query;
  const sizes = await prisma.productSize.findMany({
    where: { productId: +req.params.id },
    include: {
      stock: warehouseId ? { where: { warehouseId: +warehouseId } } : true
    },
    orderBy: { size: 'asc' }
  });
  res.json(sizes);
});

module.exports = router;
