// ============================================================
// РАЗДЕЛ A: МАРШРУТИЗАЦИЯ ПРИЛОЖЕНИЯ
// Файл: frontend/src/App.jsx
// ============================================================
// Матрица доступа к страницам:
//   admin      — полный доступ ко всем страницам
//   manager    — склад, отчёты, смены, касса, возвраты, инвентаризация
//   cashier    — касса, смены, возвраты
//   collector  — смены (просмотр), отчёты
//   inventor   — инвентаризация, остатки, товары (просмотр)
// ============================================================

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth.jsx';
import { ToastProvider } from './hooks/useToast.jsx';
import Layout from './components/Layout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ProductsPage from './pages/ProductsPage.jsx';
import ReceiptsPage from './pages/ReceiptsPage.jsx';
import IssuesPage from './pages/IssuesPage.jsx';
import StockPage from './pages/StockPage.jsx';
import SuppliersPage from './pages/SuppliersPage.jsx';
import UsersPage from './pages/UsersPage.jsx';
import WarehousesPage from './pages/WarehousesPage.jsx';
import ReportsPage from './pages/ReportsPage.jsx';
import POSPage from './pages/POSPage.jsx';
import SystemPage from './pages/SystemPage.jsx';
import TransfersPage from './pages/TransfersPage.jsx';
import DiskAlert from './components/DiskAlert.jsx';
import TariffReminder from './components/TariffReminder.jsx';
import CalendarPage from './pages/CalendarPage.jsx';
import ShiftsPage from './pages/ShiftsPage.jsx';
import ReturnsPage from './pages/ReturnsPage.jsx';
import InventoryPage from './pages/InventoryPage.jsx';

// --- A.1: Группы ролей (должны совпадать с backend/src/middleware/auth.js) ---
export const ROLES = {
  CASHIER:    ['cashier'],
  POS_ACCESS: ['admin', 'manager', 'cashier'],
  SHIFT_ACCESS:    ['admin', 'manager', 'cashier', 'collector'],
  RETURNS_ACCESS:  ['admin', 'manager', 'cashier'],
  REPORTS_ACCESS:  ['admin', 'manager', 'collector'],
  STOCK_VIEW:      ['admin', 'manager', 'inventor', 'collector'],
  INVENTORY_ACCESS:['admin', 'manager', 'inventor'],
  WAREHOUSE_MGMT:  ['admin', 'manager'],
  ADMIN_ONLY:      ['admin'],
};

// --- A.2: Компонент защиты маршрута ---
function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loader"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" />;
  return children;
}

// --- A.3: Гвард для кассы: кассир должен открыть смену ---
function POSGuard() {
  const { user } = useAuth();
  const [allowed, setAllowed] = React.useState(null);

  React.useEffect(() => {
    // Не-кассиры (admin/manager) входят без проверки смены
    if (!ROLES.CASHIER.includes(user?.role)) {
      setAllowed(true);
      return;
    }
    if (!user?.warehouseId) { setAllowed(false); return; }
    fetch(`/api/shifts/current?warehouseId=${user.warehouseId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => setAllowed(!!data?.shift))
      .catch(() => setAllowed(false));
  }, [user]);

  if (allowed === null) return <div className="loader"><div className="spinner" /></div>;
  if (!allowed) return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: 400, gap: 16, textAlign: 'center',
      color: 'var(--text3)'
    }}>
      <div style={{ fontSize: 48 }}>🔒</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
        Касса заблокирована
      </div>
      <div style={{ fontSize: 14 }}>
        Для доступа к кассе необходимо сначала открыть смену
      </div>
      <a href="/shifts" style={{
        padding: '10px 24px', background: 'var(--accent)', color: '#000',
        borderRadius: 8, fontWeight: 700, textDecoration: 'none', fontSize: 14
      }}>
        Открыть смену →
      </a>
    </div>
  );
  return <POSPage />;
}

// --- A.4: Дерево маршрутов ---
function AppRoutes() {
  const { user } = useAuth();

  return (
    <>
      <DiskAlert />
      <TariffReminder />
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" /> : <LoginPage />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>

          {/* Дашборд — все авторизованные */}
          <Route index element={<Dashboard />} />

          {/* Касса — admin/manager/cashier (с гвардом смены для кассиров) */}
          <Route path="pos" element={
            <ProtectedRoute roles={ROLES.POS_ACCESS}><POSGuard /></ProtectedRoute>
          } />

          {/* Смены — admin/manager/cashier/collector */}
          <Route path="shifts" element={
            <ProtectedRoute roles={ROLES.SHIFT_ACCESS}><ShiftsPage /></ProtectedRoute>
          } />

          {/* Возвраты — admin/manager/cashier */}
          <Route path="returns" element={
            <ProtectedRoute roles={ROLES.RETURNS_ACCESS}><ReturnsPage /></ProtectedRoute>
          } />

          {/* Товары — admin/manager/inventor */}
          <Route path="products" element={
            <ProtectedRoute roles={ROLES.INVENTORY_ACCESS}><ProductsPage /></ProtectedRoute>
          } />

          {/* Остатки — admin/manager/inventor/collector */}
          <Route path="stock" element={
            <ProtectedRoute roles={ROLES.STOCK_VIEW}><StockPage /></ProtectedRoute>
          } />

          {/* Приходы — admin/manager */}
          <Route path="receipts" element={
            <ProtectedRoute roles={ROLES.WAREHOUSE_MGMT}><ReceiptsPage /></ProtectedRoute>
          } />

          {/* Расходы — admin/manager */}
          <Route path="issues" element={
            <ProtectedRoute roles={ROLES.WAREHOUSE_MGMT}><IssuesPage /></ProtectedRoute>
          } />

          {/* Поставщики — admin/manager */}
          <Route path="suppliers" element={
            <ProtectedRoute roles={ROLES.WAREHOUSE_MGMT}><SuppliersPage /></ProtectedRoute>
          } />

          {/* Отчёты — admin/manager/collector */}
          <Route path="reports" element={
            <ProtectedRoute roles={ROLES.REPORTS_ACCESS}><ReportsPage /></ProtectedRoute>
          } />

          {/* Перемещения — admin/manager */}
          <Route path="transfers" element={
            <ProtectedRoute roles={ROLES.WAREHOUSE_MGMT}><TransfersPage /></ProtectedRoute>
          } />

          {/* Календарь — admin/manager */}
          <Route path="calendar" element={
            <ProtectedRoute roles={ROLES.WAREHOUSE_MGMT}><CalendarPage /></ProtectedRoute>
          } />

          {/* Инвентаризация — admin/manager/inventor */}
          <Route path="inventory" element={
            <ProtectedRoute roles={ROLES.INVENTORY_ACCESS}><InventoryPage /></ProtectedRoute>
          } />

          {/* Склады — только admin */}
          <Route path="warehouses" element={
            <ProtectedRoute roles={ROLES.ADMIN_ONLY}><WarehousesPage /></ProtectedRoute>
          } />

          {/* Пользователи — только admin */}
          <Route path="users" element={
            <ProtectedRoute roles={ROLES.ADMIN_ONLY}><UsersPage /></ProtectedRoute>
          } />

          {/* Система — только admin */}
          <Route path="system" element={
            <ProtectedRoute roles={ROLES.ADMIN_ONLY}><SystemPage /></ProtectedRoute>
          } />

        </Route>
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
