const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { requireRole } = require('../middleware/auth');
const prisma = new PrismaClient();

router.get('/', requireRole('admin'), async (req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, login: true, fullName: true, role: true, warehouseId: true, isActive: true, createdAt: true, warehouse: true }
  });
  res.json(users);
});

router.post('/', requireRole('admin'), async (req, res) => {
  const { login, password, fullName, role, warehouseId } = req.body;
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { login, passwordHash, fullName, role, warehouseId: warehouseId || null }
  });
  res.json({ id: user.id, login: user.login, fullName: user.fullName, role: user.role });
});

router.put('/:id', requireRole('admin'), async (req, res) => {
  const { fullName, role, warehouseId, isActive, password } = req.body;
  const data = { fullName, role, warehouseId: warehouseId || null, isActive };
  if (password) data.passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.update({ where: { id: +req.params.id }, data });
  res.json({ id: user.id, login: user.login, fullName: user.fullName, role: user.role });
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
  await prisma.user.update({ where: { id: +req.params.id }, data: { isActive: false } });
  res.json({ ok: true });
});

module.exports = router;
