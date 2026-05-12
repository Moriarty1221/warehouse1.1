// ============================================================
// РАЗДЕЛ 1: MIDDLEWARE АУТЕНТИФИКАЦИИ И АВТОРИЗАЦИИ
// Файл: backend/src/middleware/auth.js
// ============================================================
// Роли системы:
//   admin       — Администратор  (полный доступ)
//   manager     — Менеджер       (склад, отчёты, без системных настроек)
//   cashier     — Кассир         (касса, смены, возвраты)
//   collector   — Инкассатор     (просмотр смен, Z-отчёт, инкассация)
//   inventor    — Инвентор       (инвентаризация, просмотр остатков/товаров)
// ============================================================

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'warehouse_secret_key_2024';

// --- 1.1: Все допустимые роли ---
const ALL_ROLES = ['admin', 'manager', 'cashier', 'collector', 'inventor'];

// --- 1.2: Группы ролей для удобного переиспользования ---
const ROLE_GROUPS = {
  ADMIN_ONLY:        ['admin'],
  ADMIN_MANAGER:     ['admin', 'manager'],
  POS_ACCESS:        ['admin', 'manager', 'cashier'],
  SHIFT_ACCESS:      ['admin', 'manager', 'cashier', 'collector'],
  RETURNS_ACCESS:    ['admin', 'manager', 'cashier'],
  COLLECTOR_ACCESS:  ['admin', 'collector'],
  INVENTORY_ACCESS:  ['admin', 'manager', 'inventor'],
  REPORTS_ACCESS:    ['admin', 'manager', 'collector'],
  STOCK_VIEW:        ['admin', 'manager', 'inventor', 'collector'],
};

// --- 1.3: Проверка JWT токена ---
function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Не авторизован' });
  }
  try {
    const token = auth.split(' ')[1];
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Токен недействителен' });
  }
}

// --- 1.4: Проверка роли (variadic список ролей) ---
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Нет доступа',
        required: roles,
        current: req.user.role
      });
    }
    next();
  };
}

// --- 1.5: Экспорт ---
module.exports = { authenticate, requireRole, ROLE_GROUPS, ALL_ROLES };
