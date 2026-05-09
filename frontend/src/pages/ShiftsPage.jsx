import React, { useEffect, useState } from 'react';
import { Clock, Play, Square, Plus, Minus, TrendingUp, Banknote, CreditCard, ArrowRightLeft, AlertCircle } from 'lucide-react';
import { api } from '../utils/api';
import { useToast } from '../hooks/useToast.jsx';
import { useAuth } from '../hooks/useAuth.jsx';

const fmt = n => new Intl.NumberFormat('ru-RU').format(Number(n || 0));
const fmtDate = d => d ? new Date(d).toLocaleString('ru-RU', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';

function Badge({ color, children }) {
  const colors = {
    green: { bg: 'var(--green-bg)', color: 'var(--green)', border: 'rgba(0,212,170,0.3)' },
    red:   { bg: 'var(--red-bg)', color: 'var(--red)', border: 'rgba(255,77,109,0.3)' },
    blue:  { bg: 'var(--blue-bg)', color: 'var(--blue)', border: 'rgba(77,159,255,0.3)' },
  };
  const s = colors[color] || colors.blue;
  return (
    <span style={{ padding:'2px 8px', borderRadius:20, background:s.bg, color:s.color, border:'1px solid '+s.border, fontSize:11, fontWeight:600 }}>
      {children}
    </span>
  );
}

function StatCard({ label, value, sub, color = 'var(--text)' }) {
  return (
    <div className="card" style={{ padding:'16px 20px', flex:1, minWidth:140 }}>
      <div style={{ fontSize:11, color:'var(--text3)', marginBottom:6, textTransform:'uppercase', letterSpacing:0.5 }}>{label}</div>
      <div style={{ fontSize:22, fontWeight:700, color }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:'var(--text3)', marginTop:3 }}>{sub}</div>}
    </div>
  );
}

function OpenShiftModal({ warehouses, onOpen, onClose }) {
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id || '');
  const [openingCash, setOpeningCash] = useState(0);
  const [loading, setLoading] = useState(false);
  const { show } = useToast();

  const handle = async () => {
    if (!warehouseId) return show('Выберите склад', 'error');
    setLoading(true);
    try {
      await api('/shifts/open', { method:'POST', body: JSON.stringify({ warehouseId: +warehouseId, openingCash: +openingCash }) });
      show('Смена открыта', 'success');
      onOpen();
    } catch(err) { show(err.message, 'error'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth:380 }}>
        <div className="modal-header">
          <div className="modal-title">Открыть смену</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Склад</label>
            <select className="form-select" value={warehouseId} onChange={e => setWarehouseId(e.target.value)}>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Начальная сумма в кассе (сом)</label>
            <input type="number" className="form-input" min={0} value={openingCash} onChange={e => setOpeningCash(e.target.value)} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn btn-primary" onClick={handle} disabled={loading}>
            <Play size={14} /> {loading ? '...' : 'Открыть'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CashOpModal({ shiftId, onDone, onClose }) {
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const { show } = useToast();

  const labels = { expense: 'Расход', collection: 'Инкассация', deposit: 'Пополнение' };

  const handle = async () => {
    if (!amount || +amount <= 0) return show('Введите сумму', 'error');
    setLoading(true);
    try {
      await api(`/shifts/${shiftId}/cash-op`, { method:'POST', body: JSON.stringify({ type, amount:+amount, description }) });
      show(labels[type] + ' записан', 'success');
      onDone();
    } catch(err) { show(err.message, 'error'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth:380 }}>
        <div className="modal-header">
          <div className="modal-title">Кассовая операция</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Тип операции</label>
            <select className="form-select" value={type} onChange={e => setType(e.target.value)}>
              <option value="expense">Расход из кассы</option>
              <option value="collection">Инкассация (изъятие)</option>
              <option value="deposit">Пополнение кассы</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Сумма (сом)</label>
            <input type="number" className="form-input" min={0} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" />
          </div>
          <div className="form-group">
            <label className="form-label">Комментарий</label>
            <input className="form-input" value={description} onChange={e => setDescription(e.target.value)} placeholder="Необязательно..." />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn btn-primary" onClick={handle} disabled={loading}>{loading ? '...' : 'Записать'}</button>
        </div>
      </div>
    </div>
  );
}

function CloseShiftModal({ shift, onClose, onDone }) {
  const [closingCash, setClosingCash] = useState('');
  const [loading, setLoading] = useState(false);
  const { show } = useToast();

  const handle = async () => {
    setLoading(true);
    try {
      const res = await api(`/shifts/${shift.id}/close`, { method:'POST', body: JSON.stringify({ closingCash: closingCash !== '' ? +closingCash : undefined }) });
      const diff = res.cashDiff;
      if (diff === 0) show('Смена закрыта. Касса сошлась!', 'success');
      else if (diff > 0) show(`Смена закрыта. Излишек: ${fmt(diff)} сом`, 'success');
      else show(`Смена закрыта. Недостача: ${fmt(Math.abs(diff))} сом`, 'error');
      onDone();
    } catch(err) { show(err.message, 'error'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth:380 }}>
        <div className="modal-header">
          <div className="modal-title" style={{ color:'var(--red)' }}>Закрыть смену (Z-отчёт)</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ padding:'10px 14px', background:'var(--red-bg)', border:'1px solid rgba(255,77,109,0.3)', borderRadius:8, marginBottom:16, fontSize:13, color:'var(--red)' }}>
            <AlertCircle size={14} style={{ verticalAlign:'middle', marginRight:6 }} />
            После закрытия смена не может быть переоткрыта
          </div>
          <div className="form-group">
            <label className="form-label">Фактическая сумма в кассе (сом)</label>
            <input type="number" className="form-input" min={0} value={closingCash} onChange={e => setClosingCash(e.target.value)} placeholder="Оставьте пустым — будет расчётная" />
            <div style={{ fontSize:11, color:'var(--text3)', marginTop:4 }}>Если не указать — используется расчётная сумма</div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn btn-danger" onClick={handle} disabled={loading}>
            <Square size={14} /> {loading ? '...' : 'Закрыть смену'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ShiftsPage() {
  const [current, setCurrent] = useState(null);
  const [report, setReport] = useState(null);
  const [shifts, setShifts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [modal, setModal] = useState(null); // 'open' | 'cashop' | 'close'
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { show } = useToast();

  useEffect(() => {
    document.getElementById('page-title').textContent = 'Смены';
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [wh] = await Promise.all([api('/warehouses')]);
      setWarehouses(wh);
      // Try to get current shift
      try {
        const cur = await api('/shifts/current');
        setCurrent(cur.shift);
        setReport(cur.report);
      } catch { setCurrent(null); setReport(null); }
      // Load shift history (admin/manager)
      if (['admin','manager'].includes(user?.role)) {
        try { const s = await api('/shifts'); setShifts(s); } catch {}
      }
    } catch {}
    setLoading(false);
  };

  const handleXReport = async () => {
    try {
      const r = await api(`/shifts/${current.id}/x-report`);
      setReport(r);
      show('X-отчёт обновлён', 'success');
    } catch(err) { show(err.message, 'error'); }
  };

  if (loading) return <div className="loader"><div className="spinner" /></div>;

  return (
    <div>
      {/* Current shift banner */}
      {current ? (
        <div style={{ background:'rgba(0,212,170,0.06)', border:'1px solid rgba(0,212,170,0.25)', borderRadius:12, padding:'16px 20px', marginBottom:20, display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:10, height:10, borderRadius:'50%', background:'var(--green)', boxShadow:'0 0 8px var(--green)' }} />
            <span style={{ fontWeight:600, fontSize:15 }}>Смена открыта</span>
            <Badge color="green">#{current.id}</Badge>
          </div>
          <div style={{ color:'var(--text3)', fontSize:13 }}>
            {current.warehouse?.name} · Открыта: {fmtDate(current.openedAt)}
          </div>
          <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
            <button className="btn btn-secondary btn-sm" onClick={handleXReport}>
              <TrendingUp size={13} /> X-отчёт
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setModal('cashop')}>
              <Plus size={13} /> Кассовая операция
            </button>
            <button className="btn btn-danger btn-sm" onClick={() => setModal('close')}>
              <Square size={13} /> Закрыть смену
            </button>
          </div>
        </div>
      ) : (
        <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 20px', marginBottom:20, display:'flex', alignItems:'center', gap:12 }}>
          <Clock size={18} style={{ color:'var(--text3)' }} />
          <span style={{ color:'var(--text2)' }}>Нет открытой смены</span>
          <button className="btn btn-primary" style={{ marginLeft:'auto' }} onClick={() => setModal('open')}>
            <Play size={14} /> Открыть смену
          </button>
        </div>
      )}

      {/* X-Report stats */}
      {report && (
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:12, color:'var(--text3)', marginBottom:10, textTransform:'uppercase', letterSpacing:0.5 }}>
            X-Отчёт — текущая смена
          </div>
          <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
            <StatCard label="Продажи (всего)" value={fmt(report.totalSales) + ' с'} sub={`${report.salesCount} чеков`} color="var(--accent)" />
            <StatCard label="Наличные" value={fmt(report.cashSales) + ' с'} color="var(--green)" />
            <StatCard label="Карта" value={fmt(report.cardSales) + ' с'} color="var(--blue)" />
            <StatCard label="Перевод" value={fmt(report.transferSales) + ' с'} color="var(--yellow)" />
            <StatCard label="Ожид. в кассе" value={fmt(report.expectedCash) + ' с'} sub={`Начало: ${fmt(report.openingCash)} с`} />
          </div>
        </div>
      )}

      {/* Shifts history */}
      {['admin','manager'].includes(user?.role) && (
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--border)', fontWeight:600, fontSize:14 }}>
            История смен
          </div>
          {shifts.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">🕐</div><h3>Смен пока нет</h3></div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Кассир</th>
                  <th>Склад</th>
                  <th>Открыта</th>
                  <th>Закрыта</th>
                  <th>Чеков</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {shifts.map(s => (
                  <tr key={s.id}>
                    <td><span className="mono">{s.id}</span></td>
                    <td>{s.cashier?.fullName}</td>
                    <td>{s.warehouse?.name}</td>
                    <td style={{ color:'var(--text2)', fontSize:12 }}>{fmtDate(s.openedAt)}</td>
                    <td style={{ color:'var(--text2)', fontSize:12 }}>{fmtDate(s.closedAt)}</td>
                    <td>{s._count?.sales || 0}</td>
                    <td>
                      {s.status === 'open'
                        ? <Badge color="green">Открыта</Badge>
                        : <Badge color="red">Закрыта</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {modal === 'open' && <OpenShiftModal warehouses={warehouses} onOpen={() => { setModal(null); load(); }} onClose={() => setModal(null)} />}
      {modal === 'cashop' && current && <CashOpModal shiftId={current.id} onDone={() => { setModal(null); load(); }} onClose={() => setModal(null)} />}
      {modal === 'close' && current && <CloseShiftModal shift={current} onDone={() => { setModal(null); load(); }} onClose={() => setModal(null)} />}
    </div>
  );
}
