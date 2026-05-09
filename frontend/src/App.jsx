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

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loader"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <>
      <DiskAlert />
      <TariffReminder />
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" /> : <LoginPage />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="receipts" element={<ReceiptsPage />} />
          <Route path="issues" element={<IssuesPage />} />
          <Route path="stock" element={<StockPage />} />
          <Route path="suppliers" element={<SuppliersPage />} />
          <Route path="pos" element={<POSPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="transfers" element={<TransfersPage />} />
          <Route path="shifts" element={<ShiftsPage />} />
          <Route path="returns" element={<ReturnsPage />} />
          <Route path="inventory" element={<ProtectedRoute roles={['admin','manager']}><InventoryPage /></ProtectedRoute>} />
          <Route path="warehouses" element={<ProtectedRoute roles={['admin']}><WarehousesPage /></ProtectedRoute>} />
          <Route path="users" element={<ProtectedRoute roles={['admin']}><UsersPage /></ProtectedRoute>} />
          <Route path="system" element={<ProtectedRoute roles={['admin']}><SystemPage /></ProtectedRoute>} />
          <Route path="calendar" element={<CalendarPage />} />
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
