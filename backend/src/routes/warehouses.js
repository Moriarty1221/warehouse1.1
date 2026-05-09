const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { requireRole } = require('../middleware/auth');
const prisma = new PrismaClient();

router.get('/', async (req, res) => {
  const warehouses = await prisma.warehouse.findMany({ where: { isActive: true } });
  res.json(warehouses);
});

router.post('/', requireRole('admin'), async (req, res) => {
  const { name, address, description } = req.body;
  const w = await prisma.warehouse.create({ data: { name, address, description } });
  res.json(w);
});

router.put('/:id', requireRole('admin'), async (req, res) => {
  const { name, address, description, isActive } = req.body;
  const w = await prisma.warehouse.update({ where: { id: +req.params.id }, data: { name, address, description, isActive } });
  res.json(w);
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
  await prisma.warehouse.update({ where: { id: +req.params.id }, data: { isActive: false } });
  res.json({ ok: true });
});

module.exports = router;
