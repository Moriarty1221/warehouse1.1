import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package, ArrowDownCircle, ArrowUpCircle, AlertTriangle,
  TrendingUp, DollarSign, ShoppingCart, ArrowLeftRight,
  Layers, BarChart2, Clock, RotateCcw, Lock
} from 'lucide-react';
import { api } from '../utils/api';
import { useAuth } from '../hooks/useAuth.jsx';

const CASHIER_ROLES = ['cashier', 'operator'];

// ─── Дашборд для кассира ────────────────────────────────────────────────
function CashierDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [openShift, setOpenShift] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const el = document.getElementById('page-title');
    if (el) el.textContent = 'Главная';
    if (user?.warehouseId) {
      api(`/shifts/current?warehouseId=${user.warehouseId}`)
        .then(data => setOpenShift(data.shift))
        .catch(() => setOpenShift(null))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const shiftOpen = !!openShift;

  const cards = [
    {
      icon: ShoppingCart,
      label: 'Касса',
      desc: 'Продажи и чеки',
      to: '/pos',
      locked: !shiftOpen,
      lockMsg: 'Сначала откройте смену',
      color: '#00d4aa',
    },
    {
      icon: Clock,
      label: 'Смены',
      desc: shiftOpen ? `Смена #${openShift.id} открыта` : 'Откройте смену для работы',
      to: '/shifts',
      locked: false,
      color: '#3b82f6',
    },
    {
      icon: RotateCcw,
      label: 'Возвраты',
      desc: 'Оформить возврат',
      to: '/returns',
      locked: !shiftOpen,
      lockMsg: 'Сначала откройте смену',
      color: '#f59e0b',
    },
  ];

  return (
    <div style={{
      position: 'relative',
      minHeight: 'calc(100vh - 100px)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    }}>
      {/* Полупрозрачный логотип на весь экран */}
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 0,
      }}>
        <img
          src="/logo-wh365.jpg"
          alt=""
          style={{
            width: '60%',
            maxWidth: 500,
            opacity: 0.06,
            filter: 'grayscale(50%)',
            userSelect: 'none',
          }}
          onError={e => e.target.style.display = 'none'}
        />
      </div>

      {/* Приветствие */}
      <div style={{ zIndex: 1, textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>
          Добро пожаловать, {user?.fullName}!
        </div>
        <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 6 }}>
          {shiftOpen
            ? `✅ Смена #${openShift.id} открыта — можно работать`
            : '⚠️ Смена не открыта — откройте смену перед началом работы'}
        </div>
      </div>

      {/* Три карточки */}
      <div style={{
        zIndex: 1,
        display: 'flex',
        gap: 20,
        flexWrap: 'wrap',
        justifyContent: 'center',
        maxWidth: 700,
      }}>
        {cards.map(card => (
          <div
            key={card.label}
            onClick={() => { if (!card.locked) navigate(card.to); }}
            style={{
              width: 200,
              background: 'var(--bg2)',
              border: `2px solid ${card.locked ? 'var(--border)' : card.color}`,
              borderRadius: 16,
              padding: '28px 24px',
              cursor: card.locked ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              textAlign: 'center',
              opacity: card.locked ? 0.65 : 1,
              boxShadow: card.locked ? 'none' : `0 0 20px ${card.color}22`,
              position: 'relative',
            }}
            onMouseEnter={e => { if (!card.locked) { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = `0 8px 32px ${card.color}44`; }}}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = card.locked ? 'none' : `0 0 20px ${card.color}22`; }}
          >
            {card.locked && (
              <div style={{
                position: 'absolute', top: 10, right: 10,
                color: 'var(--text3)',
              }}>
                <Lock size={14} />
              </div>
            )}
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: `${card.color}22`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 14px',
              border: `2px solid ${card.color}44`,
            }}>
              <card.icon size={26} color={card.color} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
              {card.label}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.4 }}>
              {card.locked ? card.lockMsg : card.desc}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Дашборд для администратора/менеджера ──────────────────────────────
function AdminDashboard() {
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
    { icon: Package, color: 'blue', value: fmt(stats.totalProducts), label: 'Товаров в каталоге', link: '/products' },
    { icon: Layers, color: 'teal', value: fmt(stats.totalValue) + ' с', label: 'Стоимость склада', link: '/stock' },
    { icon: ArrowDownCircle, color: 'green', value: fmt(stats.totalReceipts), label: 'Всего приходов', link: '/receipts' },
    { icon: ArrowUpCircle, color: 'orange', value: fmt(stats.totalIssues), label: 'Всего расходов', link: '/issues' },
    { icon: AlertTriangle, color: stats.lowStockCount > 0 ? 'red' : 'green', value: stats.lowStockCount, label: 'Мало остатков', link: '/stock' },
    { icon: TrendingUp, color: 'blue', value: `${stats.recentReceipts} / ${stats.recentIssues}`, label: 'Прих / расх за 7 дней', link: '/reports' },
  ];

  const quickActions = [
    { icon: ArrowDownCircle, label: 'Новый приход', link: '/receipts', accent: true },
    { icon: ArrowUpCircle, label: 'Новый расход', link: '/issues' },
    { icon: ShoppingCart, label: 'Открыть кассу', link: '/pos' },
    { icon: Layers, label: 'Остатки', link: '/stock' },
    { icon: ArrowLeftRight, label: 'Перемещение', link: '/transfers' },
    { icon: BarChart2, label: 'Отчёты', link: '/reports' },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Дашборд</div>
          <div className="page-subtitle">Добро пожаловать, {user?.fullName}</div>
        </div>
      </div>

      <div className="stat-grid">
        {statCards.map((s, i) => (
          <div key={i} className="stat-card clickable" onClick={() => navigate(s.link)}>
            <div className={`stat-icon ${s.color}`}><s.icon size={18} /></div>
            <div className="stat-body">
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {stats.lowStockCount > 0 && (
        <div className="alert alert-warning" style={{ cursor: 'pointer' }} onClick={() => navigate('/stock')}>
          <AlertTriangle size={15} />
          <span><strong>{stats.lowStockCount} позиций</strong> ниже минимального остатка</span>
        </div>
      )}

      <div className="card">
        <div className="card-header"><div className="card-title">Быстрые действия</div></div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {quickActions.map((a, i) => (
            <button key={i} className={`quick-action-btn${a.accent ? ' accent' : ''}`} onClick={() => navigate(a.link)}>
              <a.icon size={14} />{a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  if (CASHIER_ROLES.includes(user?.role)) return <CashierDashboard />;
  return <AdminDashboard />;
}
