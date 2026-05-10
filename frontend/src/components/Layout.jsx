import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import {
  LayoutDashboard, Package, ArrowDownCircle, ArrowUpCircle,
  Warehouse, Users, BarChart2, Settings, LogOut, ShoppingCart,
  Truck, Layers, Menu, ArrowLeftRight, CalendarDays,
  RotateCcw, ClipboardList, Clock
} from 'lucide-react';

const navItems = [
  { section: 'Основное', items: [
    { to: '/', icon: LayoutDashboard, label: 'Дашборд', exact: true },
    { to: '/pos', icon: ShoppingCart, label: 'Касса / POS' },
    { to: '/shifts', icon: Clock, label: 'Смены' },
  ]},
  { section: 'Склад', items: [
    { to: '/products', icon: Package, label: 'Товары' },
    { to: '/stock', icon: Layers, label: 'Остатки' },
    { to: '/receipts', icon: ArrowDownCircle, label: 'Приходы' },
    { to: '/issues', icon: ArrowUpCircle, label: 'Расход' },
    { to: '/transfers', icon: ArrowLeftRight, label: 'Перемещение' },
    { to: '/returns', icon: RotateCcw, label: 'Возвраты' },
    { to: '/suppliers', icon: Truck, label: 'Поставщики' },
  ]},
  { section: 'Управление', items: [
    { to: '/inventory', icon: ClipboardList, label: 'Инвентаризация', roles: ['admin', 'manager'] },
    { to: '/warehouses', icon: Warehouse, label: 'Склады', roles: ['admin'] },
    { to: '/users', icon: Users, label: 'Пользователи', roles: ['admin'] },
    { to: '/reports', icon: BarChart2, label: 'Отчёты' },
    { to: '/calendar', icon: CalendarDays, label: 'Календарь' },
    { to: '/system', icon: Settings, label: 'Система', roles: ['admin'] },
  ]},
];

const roleLabel = {
  admin: '👑 Администратор',
  manager: '📋 Менеджер',
  cashier: '💳 Кассир',
  operator: '👤 Оператор',
};

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };

  const Logo = () => (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <img
        src="/logo-wh365.jpg"
        alt="Warehouse365"
        style={{ height:36, width:'auto', borderRadius:6, objectFit:'contain' }}
        onError={e => { e.target.style.display='none'; }}
      />
    </div>
  );

  const SidebarContent = () => (
    <>
      <div className="sidebar-logo" style={{ padding:'0 14px', height:64 }}>
        <Logo />
      </div>

      <nav className="sidebar-nav">
        {navItems.map(section => (
          <div key={section.section} className="nav-section">
            <div className="nav-section-title">{section.section}</div>
            {section.items.map(item => {
              if (item.roles && !item.roles.includes(user?.role)) return null;
              return (
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
              );
            })}
          </div>
        ))}
      </nav>

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
        <div onClick={() => setMobileOpen(false)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:99 }} />
      )}
      <aside className={'sidebar ' + (mobileOpen ? 'mobile-open' : '')}>
        <SidebarContent />
      </aside>
      <style>{`
        @media (min-width: 769px) {
          .sidebar { display: flex !important; flex-direction: column; }
        }
        @media (max-width: 768px) {
          .sidebar { display: none; position: fixed !important; z-index: 100; height: 100vh; }
          .sidebar.mobile-open { display: flex !important; flex-direction: column; }
        }
      `}</style>
      <div className="main-content">
        <div className="topbar">
          <button className="btn btn-ghost btn-icon" onClick={() => setMobileOpen(!mobileOpen)}
            id="mobile-menu-btn" style={{ display:'none' }}>
            <Menu size={18} />
          </button>
          <style>{`@media (max-width: 768px) { #mobile-menu-btn { display: flex !important; } }`}</style>
          <div className="topbar-title" id="page-title" style={{ display:'flex', alignItems:'center', gap:8 }}>
            <img src="/logo-wh365.jpg" alt="WH365" style={{ height:26, width:'auto', borderRadius:4, objectFit:'contain' }} onError={e=>e.target.style.display='none'} />
          </div>
          <div className="topbar-actions">
            {user?.warehouse && (
              <span style={{ fontSize:12, color:'var(--text3)', display:'flex', alignItems:'center', gap:4 }}>
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
