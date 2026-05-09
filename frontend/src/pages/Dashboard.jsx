import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package, ArrowDownCircle, ArrowUpCircle, AlertTriangle,
  TrendingUp, DollarSign, ShoppingCart, ArrowLeftRight,
  Layers, BarChart2
} from 'lucide-react';
import { api } from '../utils/api';
import { useAuth } from '../hooks/useAuth.jsx';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const el = document.getElementById('page-title');
    if (el) el.textContent = 'Дашборд';
    const wid = user?.role !== 'admin' && user?.warehouseId ? `?warehouseId=${user.warehouseId}` : '';
    api(`/reports/dashboard${wid}`).then(setStats).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loader"><div className="spinner" /></div>;
  if (!stats) return null;

  const fmt = (n) => new Intl.NumberFormat('ru-RU').format(Math.round(n || 0));

  const statCards = [
    {
      icon: Package, color: 'blue',
      value: fmt(stats.totalProducts),
      label: 'Товаров в каталоге',
      link: '/products',
    },
    {
      icon: Layers, color: 'teal',
      value: fmt(stats.totalValue) + ' с',
      label: 'Стоимость склада',
      link: '/stock',
    },
    {
      icon: ArrowDownCircle, color: 'green',
      value: fmt(stats.totalReceipts),
      label: 'Всего приходов',
      link: '/receipts',
    },
    {
      icon: ArrowUpCircle, color: 'orange',
      value: fmt(stats.totalIssues),
      label: 'Всего расходов',
      link: '/issues',
    },
    {
      icon: AlertTriangle, color: stats.lowStockCount > 0 ? 'red' : 'green',
      value: stats.lowStockCount,
      label: 'Мало остатков',
      link: '/stock',
    },
    {
      icon: TrendingUp, color: 'blue',
      value: `${stats.recentReceipts} / ${stats.recentIssues}`,
      label: 'Прих / расх за 7 дней',
      link: '/reports',
    },
  ];

  const quickActions = [
    { icon: ArrowDownCircle, label: 'Новый приход', link: '/receipts', accent: true },
    { icon: ArrowUpCircle,   label: 'Новый расход', link: '/issues' },
    { icon: ShoppingCart,    label: 'Открыть кассу', link: '/pos' },
    { icon: Layers,          label: 'Остатки',       link: '/stock' },
    { icon: ArrowLeftRight,  label: 'Перемещение',   link: '/transfers' },
    { icon: BarChart2,       label: 'Отчёты',        link: '/reports' },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Дашборд</div>
          <div className="page-subtitle">Добро пожаловать, {user?.fullName}</div>
        </div>
      </div>

      {/* Stats */}
      <div className="stat-grid">
        {statCards.map((s, i) => (
          <div
            key={i}
            className={'stat-card clickable'}
            onClick={() => navigate(s.link)}
          >
            <div className={`stat-icon ${s.color}`}>
              <s.icon size={18} />
            </div>
            <div className="stat-body">
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Alert */}
      {stats.lowStockCount > 0 && (
        <div className="alert alert-warning" style={{ cursor: 'pointer' }} onClick={() => navigate('/stock')}>
          <AlertTriangle size={15} />
          <span>
            <strong>{stats.lowStockCount} позиций</strong> ниже минимального остатка — нажмите, чтобы проверить
          </span>
        </div>
      )}

      {/* Quick actions */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Быстрые действия</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {quickActions.map((a, i) => (
            <button
              key={i}
              className={`quick-action-btn${a.accent ? ' accent' : ''}`}
              onClick={() => navigate(a.link)}
            >
              <a.icon size={14} />
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
