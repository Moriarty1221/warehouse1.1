// ============================================================
// РАЗДЕЛ 14: ПОСТАВЩИКИ
// Файл: backend/src/routes/suppliers.js
// Доступ: admin, manager
// ============================================================

const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

router.get('/', async (req, res) => {
  res.json(await prisma.supplier.findMany({ orderBy: { name: 'asc' } }));
});
router.post('/', async (req, res) => {
  res.json(await prisma.supplier.create({ data: req.body }));
});
router.put('/:id', async (req, res) => {
  res.json(await prisma.supplier.update({ where: { id: +req.params.id }, data: req.body }));
});
router.delete('/:id', async (req, res) => {
  await prisma.supplier.delete({ where: { id: +req.params.id } });
  res.json({ ok: true });
});

module.exports = router;
