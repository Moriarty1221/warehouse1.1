// ============================================================
// РАЗДЕЛ 2: УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ
// Файл: backend/src/routes/users.js
// Доступ: только admin
// ============================================================

const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { requireRole, ALL_ROLES } = require('../middleware/auth');
const prisma = new PrismaClient();

// --- 2.1: Список пользователей ---
router.get('/', requireRole('admin'), async (req, res) => {
  const users = await prisma.user.findMany({
    select: {
      id: true, login: true, fullName: true, role: true,
      warehouseId: true, isActive: true, createdAt: true, warehouse: true
    }
  });
  res.json(users);
});

// --- 2.2: Создание пользователя ---
router.post('/', requireRole('admin'), async (req, res) => {
  const { login, password, fullName, role, warehouseId } = req.body;

  // Проверяем, что роль допустима
  if (!ALL_ROLES.includes(role)) {
    return res.status(400).json({ error: `Недопустимая роль. Допустимые: ${ALL_ROLES.join(', ')}` });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { login, passwordHash, fullName, role, warehouseId: warehouseId || null }
  });
  res.json({ id: user.id, login: user.login, fullName: user.fullName, role: user.role });
});

// --- 2.3: Редактирование пользователя ---
router.put('/:id', requireRole('admin'), async (req, res) => {
  const { fullName, role, warehouseId, isActive, password } = req.body;

  if (role && !ALL_ROLES.includes(role)) {
    return res.status(400).json({ error: `Недопустимая роль. Допустимые: ${ALL_ROLES.join(', ')}` });
  }

  const data = { fullName, role, warehouseId: warehouseId || null, isActive };
  if (password) data.passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.update({ where: { id: +req.params.id }, data });
  res.json({ id: user.id, login: user.login, fullName: user.fullName, role: user.role });
});

// --- 2.4: Деактивация пользователя ---
router.delete('/:id', requireRole('admin'), async (req, res) => {
  await prisma.user.update({ where: { id: +req.params.id }, data: { isActive: false } });
  res.json({ ok: true });
});

module.exports = router;
