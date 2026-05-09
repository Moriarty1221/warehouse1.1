// categories.js
const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SHOE_CATEGORIES = [
  'Кроссовки', 'Туфли', 'Ботинки', 'Сандалии', 'Детская обувь',
  'Спортивная обувь', 'Зимняя обувь', 'Аксессуары для обуви'
];

router.get('/', async (req, res) => {
  let cats = await prisma.category.findMany({ include: { children: true }, where: { parentId: null } });
  // If no categories, seed shoe categories automatically
  if (cats.length === 0) {
    for (const name of SHOE_CATEGORIES) {
      await prisma.category.create({ data: { name } });
    }
    cats = await prisma.category.findMany({ include: { children: true }, where: { parentId: null } });
  }
  res.json(cats);
});
router.post('/', async (req, res) => {
  const c = await prisma.category.create({ data: req.body });
  res.json(c);
});
router.put('/:id', async (req, res) => {
  const c = await prisma.category.update({ where: { id: +req.params.id }, data: req.body });
  res.json(c);
});
router.delete('/:id', async (req, res) => {
  await prisma.category.delete({ where: { id: +req.params.id } });
  res.json({ ok: true });
});

module.exports = router;
