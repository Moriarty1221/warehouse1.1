// Скрипт дедупликации SKU и barcode перед миграцией
// Запускается автоматически перед prisma db push
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function dedup() {
  console.log('🔧 Checking for duplicate SKUs and barcodes...');

  // Найти все дубликаты SKU
  const allProducts = await prisma.product.findMany({
    select: { id: true, sku: true, barcode: true, name: true },
    orderBy: { id: 'asc' }
  });

  // Дедуплицируем SKU — оставляем первый, остальным добавляем суффикс _DUP_id
  const seenSku = new Map();
  for (const p of allProducts) {
    if (!p.sku) continue;
    if (seenSku.has(p.sku)) {
      const newSku = `${p.sku}_DUP_${p.id}`;
      console.log(`⚠️  Duplicate SKU "${p.sku}" for product #${p.id} "${p.name}" → renamed to "${newSku}"`);
      await prisma.product.update({ where: { id: p.id }, data: { sku: newSku } });
    } else {
      seenSku.set(p.sku, p.id);
    }
  }

  // Дедуплицируем barcode
  const seenBarcode = new Map();
  for (const p of allProducts) {
    if (!p.barcode) continue;
    if (seenBarcode.has(p.barcode)) {
      console.log(`⚠️  Duplicate barcode "${p.barcode}" for product #${p.id} "${p.name}" → cleared`);
      await prisma.product.update({ where: { id: p.id }, data: { barcode: null } });
    } else {
      seenBarcode.set(p.barcode, p.id);
    }
  }

  console.log('✅ Dedup complete');
}

dedup().catch(e => {
  console.error('Dedup error (non-fatal):', e.message);
}).finally(() => prisma.$disconnect());
