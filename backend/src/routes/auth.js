const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'warehouse_secret_key_2024';

router.post('/login', async (req, res) => {
  const { login, password } = req.body;
  const user = await prisma.user.findUnique({ where: { login }, include: { warehouse: true } });
  if (!user || !user.isActive) return res.status(401).json({ error: 'Неверный логин или пароль' });
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Неверный логин или пароль' });
  const token = jwt.sign(
    { id: user.id, login: user.login, role: user.role, warehouseId: user.warehouseId },
    JWT_SECRET, { expiresIn: '24h' }
  );
  res.json({ token, user: { id: user.id, login: user.login, fullName: user.fullName, role: user.role, warehouse: user.warehouse } });
});

router.get('/me', require('../middleware/auth').authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { warehouse: true },
    select: { id: true, login: true, fullName: true, role: true, warehouseId: true, warehouse: true, isActive: true, createdAt: true }
  });
  res.json(user);
});

module.exports = router;
