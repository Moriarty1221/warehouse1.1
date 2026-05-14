// ============================================================
// РАЗДЕЛ 6: ТОВАРЫ
// Файл: backend/src/routes/products.js
// Архитектура: один товар = одна модель, размеры внутри модели
// SKU и barcode только у Product, НЕ у ProductSize
// ============================================================

const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { requireRole } = require('../middleware/auth');
const prisma = new PrismaClient();

// --- 6.1: Список товаров ---
router.get('/', requireRole('admin', 'manager', 'inventor', 'cashier'), async (req, res) => {
  try {
    const { categoryId, supplierId, search, brand, gender, season } = req.query;
    const where = { isActive: true };
    if (categoryId) where.categoryId = +categoryId;
    if (supplierId) where.supplierId = +supplierId;
    if (brand) where.brand = brand;
    if (gender) where.gender = gender;
    if (season) where.season = season;
    if (search) {
      where.OR = [
        { name:      { contains: search, mode: 'insensitive' } },
        { sku:       { contains: search, mode: 'insensitive' } },
        { barcode:   { contains: search, mode: 'insensitive' } },
        { brand:     { contains: search, mode: 'insensitive' } },
        { modelCode: { contains: search, mode: 'insensitive' } },
      ];
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        category: true,
        supplier:  true,
        stock:     { include: { warehouse: true } },
        sizes: {
          include: { stock: true },
          orderBy: { size: 'asc' }
        }
      },
      orderBy: { name: 'asc' }
    });
    res.json(products);
  } catch (err) {
    console.error('GET /products error:', err);
    res.status(500).json({ error: 'Ошибка получения товаров' });
  }
});

// --- 6.2: Создать товар ---
// Payload: { sku, barcode, name, brand, modelCode, ... , sizes: [{size, qty}] }
// Повторяющиеся размеры объединяются: [{size:'42',qty:1},{size:'42',qty:1}] → size 42, qty 2
router.post('/', requireRole('admin', 'manager'), async (req, res) => {
  try {
    const { sku, barcode, name, modelCode, brand, gender, season,
            categoryId, supplierId, unit, minStock, costPrice, salePrice,
            description, sizes, warehouseId } = req.body;

    if (!name?.trim()) return res.status(400).json({ error: 'Название обязательно' });
    if (!sku?.trim())  return res.status(400).json({ error: 'SKU обязателен' });

    // Объединяем повторяющиеся размеры: 42+42 → 42 qty:2
    const sizeMap = {};
    (sizes || []).forEach(s => {
      const key = String(s.size).trim();
      if (!key) return;
      sizeMap[key] = (sizeMap[key] || 0) + (parseFloat(s.qty) || 1);
    });
    const uniqueSizes = Object.entries(sizeMap).map(([size, qty]) => ({ size, qty }));

    // warehouseId нужен для создания SizeStock сразу при добавлении товара
    const wId = warehouseId ? +warehouseId : null;

    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          sku:             sku.trim(),
          barcode:         barcode?.trim() || null,
          name:            name.trim(),
          modelCode:       modelCode?.trim() || null,
          brand:           brand?.trim() || null,
          gender:          gender || null,
          season:          season || null,
          categoryId:      categoryId ? +categoryId : null,
          supplierId:      supplierId ? +supplierId : null,
          unit:            unit || 'пар',
          minStock:        minStock ? +minStock : 0,
          costPrice:       costPrice ? +costPrice : 0,
          salePrice:       salePrice ? +salePrice : 0,
          description:     description || null,
          hasMultipleSizes: uniqueSizes.length > 0,
          sizes: uniqueSizes.length > 0 ? {
            create: uniqueSizes.map(s => ({ size: s.size }))
          } : undefined
        },
        include: { category: true, supplier: true, sizes: { include: { stock: true } } }
      });

      // ИСПРАВЛЕНО: сразу создаём SizeStock и Stock если передан warehouseId и qty > 0
      if (wId && uniqueSizes.length > 0) {
        const totalQty = uniqueSizes.reduce((s, x) => s + x.qty, 0);
        for (const size of created.sizes) {
          const sizeData = uniqueSizes.find(u => u.size === size.size);
          const qty = sizeData?.qty || 0;
          if (qty > 0) {
            await tx.sizeStock.create({
              data: { sizeId: size.id, warehouseId: wId, quantity: qty, avgCost: costPrice ? +costPrice : 0 }
            });
          }
        }
        // Суммарный Stock для товара
        await tx.stock.upsert({
          where: { productId_warehouseId: { productId: created.id, warehouseId: wId } },
          update: { quantity: { increment: totalQty } },
          create: { productId: created.id, warehouseId: wId, quantity: totalQty, avgCost: costPrice ? +costPrice : 0 }
        });
      }

      // Перечитываем с актуальными остатками
      return tx.product.findUnique({
        where: { id: created.id },
        include: { category: true, supplier: true, sizes: { include: { stock: true } } }
      });
    });

    res.json(product);
  } catch (err) {
    console.error('POST /products error:', err);
    if (err.code === 'P2002') {
      const field = err.meta?.target?.includes('barcode') ? 'Штрихкод' : 'SKU';
      return res.status(400).json({ error: `${field} уже занят другим товаром` });
    }
    res.status(500).json({ error: 'Ошибка создания товара: ' + err.message });
  }
});

// --- 6.3: Обновить товар ---
router.put('/:id', requireRole('admin', 'manager'), async (req, res) => {
  try {
    const id = +req.params.id;
    const { sku, barcode, name, modelCode, brand, gender, season,
            categoryId, supplierId, unit, minStock, costPrice, salePrice,
            description, isActive } = req.body;

    const newSku     = sku?.trim();
    const newBarcode = barcode?.trim() || null;

    // Проверяем уникальность SKU — только если занят ДРУГИМ товаром
    if (newSku) {
      const skuConflict = await prisma.product.findFirst({
        where: { sku: newSku, id: { not: id } }
      });
      if (skuConflict) {
        return res.status(400).json({ error: 'SKU уже занят другим товаром' });
      }
    }

    // Проверяем уникальность штрихкода — только если занят ДРУГИМ товаром
    if (newBarcode) {
      const barcodeConflict = await prisma.product.findFirst({
        where: { barcode: newBarcode, id: { not: id } }
      });
      if (barcodeConflict) {
        return res.status(400).json({ error: 'Штрихкод уже занят другим товаром' });
      }
    }

    const product = await prisma.product.update({
      where: { id },
      data: {
        sku:         newSku,
        barcode:     newBarcode,
        name:        name?.trim(),
        modelCode:   modelCode?.trim() || null,
        brand:       brand?.trim() || null,
        gender:      gender || null,
        season:      season || null,
        categoryId:  categoryId ? +categoryId : null,
        supplierId:  supplierId ? +supplierId : null,
        unit,
        minStock:    +minStock,
        costPrice:   +costPrice,
        salePrice:   +salePrice,
        description,
        isActive:    isActive !== undefined ? isActive : true
      },
      include: { category: true, supplier: true, sizes: { include: { stock: true } } }
    });
    res.json(product);
  } catch (err) {
    console.error('PUT /products error:', err);
    if (err.code === 'P2002') {
      const field = err.meta?.target?.includes('barcode') ? 'Штрихкод' : 'SKU';
      return res.status(400).json({ error: `${field} уже занят` });
    }
    res.status(500).json({ error: 'Ошибка обновления товара' });
  }
});

// --- 6.4: Деактивировать товар ---
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    await prisma.product.update({ where: { id: +req.params.id }, data: { isActive: false } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка удаления товара' });
  }
});

// --- 6.5: Размеры конкретного товара ---
router.get('/:id/sizes', async (req, res) => {
  try {
    const { warehouseId } = req.query;
    const sizes = await prisma.productSize.findMany({
      where: { productId: +req.params.id },
      include: {
        stock: warehouseId ? { where: { warehouseId: +warehouseId } } : true
      },
      orderBy: { size: 'asc' }
    });
    res.json(sizes);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка получения размеров' });
  }
});

// --- 6.6: Найти по штрихкоду или SKU (для POS сканера) ---
router.get('/find/:identifier', async (req, res) => {
  try {
    const id = req.params.identifier;
    const { warehouseId } = req.query;
    const product = await prisma.product.findFirst({
      where: {
        isActive: true,
        OR: [{ sku: id }, { barcode: id }]
      },
      include: {
        category: true,
        sizes: {
          include: {
            stock: warehouseId ? { where: { warehouseId: +warehouseId } } : true
          },
          orderBy: { size: 'asc' }
        },
        stock: warehouseId ? { where: { warehouseId: +warehouseId } } : true
      }
    });
    if (!product) return res.status(404).json({ error: 'Товар не найден' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка поиска товара' });
  }
});

module.exports = router;
