const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const adminExists = await prisma.user.findUnique({ where: { login: 'Admin787' } });
  if (!adminExists) {
    await prisma.user.create({
      data: {
        login: 'Admin787',
        passwordHash: await bcrypt.hash('admin1221', 10),
        fullName: 'Администратор',
        role: 'admin',
        isActive: true
      }
    });
    console.log('✅ Admin user created: Admin787 / admin1221');
  }

  // Default warehouse
  const wh = await prisma.warehouse.upsert({
    where: { id: 1 },
    update: {},
    create: { name: 'Основной склад', address: 'Главный адрес', isActive: true }
  });
  console.log('✅ Default warehouse:', wh.name);

  // Categories
  const cat1 = await prisma.category.upsert({ where: { id: 1 }, update: {}, create: { id: 1, name: 'Кроссовки' } });
  const cat2 = await prisma.category.upsert({ where: { id: 2 }, update: {}, create: { id: 2, name: 'Туфли' } });
  const cat3 = await prisma.category.upsert({ where: { id: 3 }, update: {}, create: { id: 3, name: 'Ботинки' } });
  const cat4 = await prisma.category.upsert({ where: { id: 4 }, update: {}, create: { id: 4, name: 'Сандалии' } });
  const cat5 = await prisma.category.upsert({ where: { id: 5 }, update: {}, create: { id: 5, name: 'Детская обувь' } });
  const cat6 = await prisma.category.upsert({ where: { id: 6 }, update: {}, create: { id: 6, name: 'Спортивная обувь' } });
  const cat7 = await prisma.category.upsert({ where: { id: 7 }, update: {}, create: { id: 7, name: 'Зимняя обувь' } });
  const cat8 = await prisma.category.upsert({ where: { id: 8 }, update: {}, create: { id: 8, name: 'Аксессуары для обуви' } });
  console.log('✅ Shoe categories created');

  // Sample shoe products
  const products = [
    { sku: 'NIKE-AM270-42', name: 'Nike Air Max 270 — 42р', categoryId: cat1.id, unit: 'пар', minStock: 5, price: 4500 },
    { sku: 'ADIDAS-UB22-41', name: 'Adidas Ultraboost 22 — 41р', categoryId: cat1.id, unit: 'пар', minStock: 3, price: 5200 },
    { sku: 'PUMA-RS-40', name: 'Puma RS-X — 40р', categoryId: cat6.id, unit: 'пар', minStock: 5, price: 3800 },
    { sku: 'CONVERSE-WH-39', name: 'Converse All Star White — 39р', categoryId: cat1.id, unit: 'пар', minStock: 10, price: 2900 },
  ];

  for (const p of products) {
    await prisma.product.upsert({ where: { sku: p.sku }, update: {}, create: p });
  }
  console.log('✅ Sample products created');

  // Supplier
  await prisma.supplier.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, name: 'Обувная фабрика Кыргызстан', contact: 'Айбек Усупов', phone: '+996 700 111 222' }
  });
  console.log('✅ Sample supplier created');
  console.log('\n🎉 Seed complete! Login: Admin787 / admin1221');
}

main().catch(console.error).finally(() => prisma.$disconnect());
