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

// Хелпер: безопасно парсим warehouseId (строка "1" → число 1, "" → null)
const parseWarehouseId = (val) => {
  const n = parseInt(val, 10);
  return isNaN(n) ? null : n;
};

// --- 2.1: Список пользователей ---
router.get('/', requireRole('admin'), async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true, login: true, fullName: true, role: true,
        warehouseId: true, isActive: true, createdAt: true, warehouse: true
      }
    });
    res.json(users);
  } catch (err) {
    console.error('GET /users error:', err);
    res.status(500).json({ error: 'Ошибка получения пользователей' });
  }
});

// --- 2.2: Создание пользователя ---
router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const { login, password, fullName, role, warehouseId } = req.body;

    if (!login || !password || !fullName) {
      return res.status(400).json({ error: 'Логин, пароль и имя обязательны' });
    }

    if (!ALL_ROLES.includes(role)) {
      return res.status(400).json({ error: `Недопустимая роль. Допустимые: ${ALL_ROLES.join(', ')}` });
    }

    // ИСПРАВЛЕНО: warehouseId парсим в число, иначе Prisma выбрасывает ошибку типа
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        login,
        passwordHash,
        fullName,
        role,
        warehouseId: parseWarehouseId(warehouseId)
      },
      select: { id: true, login: true, fullName: true, role: true, warehouseId: true }
    });

    res.json(user);
  } catch (err) {
    console.error('POST /users error:', err);
    // Дублирующий логин (unique constraint)
    if (err.code === 'P2002') {
      return res.status(400).json({ error: `Логин уже занят` });
    }
    res.status(500).json({ error: 'Ошибка создания пользователя' });
  }
});

// --- 2.3: Редактирование пользователя ---
router.put('/:id', requireRole('admin'), async (req, res) => {
  try {
    const { fullName, role, warehouseId, isActive, password } = req.body;

    if (role && !ALL_ROLES.includes(role)) {
      return res.status(400).json({ error: `Недопустимая роль. Допустимые: ${ALL_ROLES.join(', ')}` });
    }

    // ИСПРАВЛЕНО: warehouseId парсим в число
    const data = {
      fullName,
      role,
      warehouseId: parseWarehouseId(warehouseId),
      isActive
    };
    if (password) data.passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.update({
      where: { id: +req.params.id },
      data,
      select: { id: true, login: true, fullName: true, role: true, warehouseId: true }
    });

    res.json(user);
  } catch (err) {
    console.error('PUT /users/:id error:', err);
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    res.status(500).json({ error: 'Ошибка обновления пользователя' });
  }
});

// --- 2.4: Деактивация пользователя ---
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    await prisma.user.update({ where: { id: +req.params.id }, data: { isActive: false } });
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /users/:id error:', err);
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    res.status(500).json({ error: 'Ошибка деактивации пользователя' });
  }
});

module.exports = router;
