// ============================================================
// РАЗДЕЛ B: БОКОВОЕ МЕНЮ / НАВИГАЦИЯ
// Файл: frontend/src/components/Layout.jsx
// ============================================================
// Меню строится динамически по роли пользователя:
//   admin     — всё меню
//   manager   — склад, смены, касса, инвентаризация, отчёты
//   cashier   — только касса, смены, возвраты
//   collector — только смены, отчёты, остатки
//   inventor  — инвентаризация, товары, остатки
// ============================================================

import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import {
  LayoutDashboard, Package, ArrowDownCircle, ArrowUpCircle,
  Warehouse, Users, BarChart2, Settings, LogOut, ShoppingCart,
  Truck, Layers, Menu, ArrowLeftRight, CalendarDays,
  RotateCcw, ClipboardList, Clock, AlertTriangle
} from 'lucide-react';
import { api } from '../utils/api';

// --- B.1: Метки и иконки ролей ---
const roleLabel = {
  admin:     '👑 Администратор',
  manager:   '📋 Менеджер',
  cashier:   '💳 Кассир',
  collector: '🏦 Инкассатор',
  inventor:  '📦 Инвентор',
};

// --- B.2: Полное меню (для admin) ---
// Поле `roles` — массив ролей, которые видят этот пункт (undefined = все авторизованные)
const NAV_ITEMS = [
  {
    section: 'Основное',
    items: [
      { to: '/',        icon: LayoutDashboard, label: 'Дашборд',  exact: true },
      { to: '/pos',     icon: ShoppingCart,    label: 'Касса / POS', roles: ['admin', 'manager', 'cashier'] },
      { to: '/shifts',  icon: Clock,           label: 'Смены',    roles: ['admin', 'manager', 'cashier', 'collector'] },
    ]
  },
  {
    section: 'Склад',
    items: [
      { to: '/products',  icon: Package,         label: 'Товары',       roles: ['admin', 'manager', 'inventor'] },
      { to: '/stock',     icon: Layers,          label: 'Остатки',      roles: ['admin', 'manager', 'inventor', 'collector'] },
      { to: '/receipts',  icon: ArrowDownCircle, label: 'Приходы',      roles: ['admin', 'manager'] },
      { to: '/issues',    icon: ArrowUpCircle,   label: 'Расход',       roles: ['admin', 'manager'] },
      { to: '/transfers', icon: ArrowLeftRight,  label: 'Перемещение',  roles: ['admin', 'manager'] },
      { to: '/returns',   icon: RotateCcw,       label: 'Возвраты',     roles: ['admin', 'manager', 'cashier'] },
      { to: '/suppliers', icon: Truck,           label: 'Поставщики',   roles: ['admin', 'manager'] },
    ]
  },
  {
    section: 'Управление',
    items: [
      { to: '/inventory',  icon: ClipboardList, label: 'Инвентаризация', roles: ['admin', 'manager', 'inventor'] },
      { to: '/warehouses', icon: Warehouse,     label: 'Склады',         roles: ['admin'] },
      { to: '/users',      icon: Users,         label: 'Пользователи',   roles: ['admin'] },
      { to: '/reports',    icon: BarChart2,     label: 'Отчёты',         roles: ['admin', 'manager', 'collector'] },
      { to: '/calendar',   icon: CalendarDays,  label: 'Календарь',      roles: ['admin', 'manager'] },
      { to: '/system',     icon: Settings,      label: 'Система',        roles: ['admin'] },
    ]
  },
];

// --- B.3: Основной компонент ---
export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showShiftWarning, setShowShiftWarning] = useState(false);
  const [openShift, setOpenShift] = useState(null);

  // --- B.3.1: Загрузка текущей смены ---
  useEffect(() => {
    if (!user?.warehouseId) return;
    api(`/shifts/current?warehouseId=${user.warehouseId}`)
      .then(data => setOpenShift(data.shift))
      .catch(() => setOpenShift(null));
  }, [user]);

  // --- B.3.2: Уведомление «Закройте смену» в 20:00 ---
  useEffect(() => {
    const checkTime = () => {
      const h = new Date().getHours();
      setShowShiftWarning(h >= 20 && !!openShift);
    };
    checkTime();
    const interval = setInterval(checkTime, 60000);
    return () => clearInterval(interval);
  }, [openShift]);

  const handleLogout = () => { logout(); navigate('/login'); };

  // --- B.3.3: Логотип ---
  const Logo = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <img
        src="/logo-wh365.jpg"
        alt="Warehouse365"
        style={{ height: 36, width: 'auto', borderRadius: 6, objectFit: 'contain' }}
        onError={e => { e.target.style.display = 'none'; }}
      />
    </div>
  );

  // --- B.3.4: Содержимое сайдбара ---
  const SidebarContent = () => (
    <>
      <div className="sidebar-logo" style={{ padding: '0 14px', height: 64 }}>
        <Logo />
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map(section => {
          // Фильтруем пункты по роли
          const visibleItems = section.items.filter(item =>
            !item.roles || item.roles.includes(user?.role)
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.section} className="nav-section">
              <div className="nav-section-title">{section.section}</div>
              {visibleItems.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.exact}
                  className={({ isActive }) => 'nav-item ' + (isActive ? 'active' : '')}
                  onClick={() => setMobileOpen(false)}
                >
                  <item.icon className="nav-icon" size={16} />
                  <span className="nav-label">{item.label}</span>
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>

      {/* --- B.3.5: Блок пользователя --- */}
      <div className="sidebar-user">
        <div className="user-card">
          <div className="user-name">{user?.fullName}</div>
          <div className="user-role">{roleLabel[user?.role] || user?.role}</div>
        </div>
        <button className="logout-btn" onClick={handleLogout}>
          <LogOut size={15} />
          Выйти из системы
        </button>
      </div>
    </>
  );

  return (
    <div className="app-layout">
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 99 }}
        />
      )}

      <aside className={'sidebar ' + (mobileOpen ? 'mobile-open' : '')}>
        <SidebarContent />
      </aside>

      <style>{`
        @media (min-width: 769px) { .sidebar { display: flex !important; flex-direction: column; } }
        @media (max-width: 768px) {
          .sidebar { display: none; position: fixed !important; z-index: 100; height: 100vh; }
          .sidebar.mobile-open { display: flex !important; flex-direction: column; }
        }
      `}</style>

      <div className="main-content">
        {/* --- B.3.6: Уведомление о закрытии смены --- */}
        {showShiftWarning && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 999,
            background: 'linear-gradient(90deg, #ef4444, #b91c1c)',
            color: '#fff', padding: '10px 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            fontWeight: 700, fontSize: 14, letterSpacing: 0.3,
            boxShadow: '0 2px 12px rgba(239,68,68,0.4)'
          }}>
            <AlertTriangle size={18} />
            ⏰ Рабочий день заканчивается — пожалуйста, закройте смену!
            <button
              onClick={() => navigate('/shifts')}
              style={{
                marginLeft: 12, background: 'rgba(255,255,255,0.2)',
                border: '1px solid rgba(255,255,255,0.5)',
                color: '#fff', borderRadius: 6, padding: '3px 12px',
                cursor: 'pointer', fontSize: 12, fontWeight: 600
              }}
            >
              Перейти к сменам →
            </button>
          </div>
        )}

        <div className="topbar" style={{ marginTop: showShiftWarning ? 42 : 0 }}>
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => setMobileOpen(!mobileOpen)}
            id="mobile-menu-btn"
            style={{ display: 'none' }}
          >
            <Menu size={18} />
          </button>
          <style>{`@media (max-width: 768px) { #mobile-menu-btn { display: flex !important; } }`}</style>
          <div className="topbar-title" id="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img
              src="/logo-wh365.jpg"
              alt="WH365"
              style={{ height: 26, width: 'auto', borderRadius: 4, objectFit: 'contain' }}
              onError={e => e.target.style.display = 'none'}
            />
          </div>
          <div className="topbar-actions">
            {user?.warehouse && (
              <span style={{ fontSize: 12, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Warehouse size={13} /> {user.warehouse.name}
              </span>
            )}
          </div>
        </div>

        <div className="page-body">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
