import React, { useEffect, useState, useRef } from 'react';
import { ClipboardList, Plus, Play, CheckSquare, Scan, Search, ChevronDown, ChevronUp, Pencil, Trash2 } from 'lucide-react';
import { api } from '../utils/api';
import { useToast } from '../hooks/useToast.jsx';
import { useAuth } from '../hooks/useAuth.jsx';
import TelegramReportButton from '../components/TelegramReportButton.jsx';

const fmt = n => new Intl.NumberFormat('ru-RU').format(Number(n || 0));
const fmtDate = d => d ? new Date(d).toLocaleString('ru-RU', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';

const STATUS = {
  draft:       { label:'Черновик', color:'var(--text3)', bg:'rgba(77,96,128,0.15)' },
  in_progress: { label:'В процессе', color:'var(--yellow)', bg:'var(--yellow-bg)' },
  completed:   { label:'Завершена', color:'var(--green)', bg:'var(--green-bg)' },
};

function StatusBadge({ status }) {
  const s = STATUS[status] || STATUS.draft;
  return (
    <span style={{ padding:'2px 9px', borderRadius:20, background:s.bg, color:s.color, fontSize:11, fontWeight:600 }}>
      {s.label}
    </span>
  );
}

function NewInventoryModal({ warehouses, onSave, onClose }) {
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id || '');
  const [type, setType] = useState('full');
  const [loading, setLoading] = useState(false);
  const { show } = useToast();

  const handle = async () => {
    if (!warehouseId) return show('Выберите склад', 'error');
    setLoading(true);
    try {
      await api('/inventory', { method:'POST', body: JSON.stringify({ warehouseId:+warehouseId, type }) });
      show('Инвентаризация создана', 'success');
      onSave();
    } catch(err) { show(err.message, 'error'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth:380 }}>
        <div className="modal-header">
          <div className="modal-title">Новая инвентаризация</div>
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
            <label className="form-label">Тип инвентаризации</label>
            <select className="form-select" value={type} onChange={e => setType(e.target.value)}>
              <option value="full">Полная (все товары)</option>
              <option value="partial">Частичная (по категории)</option>
            </select>
          </div>
          <div style={{ padding:'10px 14px', background:'var(--blue-bg)', border:'1px solid rgba(77,159,255,0.3)', borderRadius:8, fontSize:12, color:'var(--blue)' }}>
            После создания инвентаризации нужно запустить её и ввести фактические остатки по каждому товару
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn btn-primary" onClick={handle} disabled={loading}>
            <Plus size={14} /> {loading ? '...' : 'Создать'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditInventoryModal({ inv, warehouses, onSave, onClose }) {
  const [warehouseId, setWarehouseId] = useState(inv.warehouseId || warehouses[0]?.id || '');
  const [type, setType] = useState(inv.type || 'full');
  const [loading, setLoading] = useState(false);
  const { show } = useToast();

  const handle = async () => {
    setLoading(true);
    try {
      await api(`/inventory/${inv.id}`, {
        method: 'PUT',
        body: JSON.stringify({ warehouseId: +warehouseId, type })
      });
      show('Инвентаризация обновлена', 'success');
      onSave();
    } catch(err) { show(err.message, 'error'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth:380 }}>
        <div className="modal-header">
          <div className="modal-title">Редактировать инвентаризацию #{inv.id}</div>
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
            <label className="form-label">Тип инвентаризации</label>
            <select className="form-select" value={type} onChange={e => setType(e.target.value)}>
              <option value="full">Полная (все товары)</option>
              <option value="partial">Частичная (по категории)</option>
            </select>
          </div>
          <div style={{ padding:'10px 14px', background:'var(--yellow-bg)', border:'1px solid rgba(255,204,0,0.3)', borderRadius:8, fontSize:12, color:'var(--yellow)' }}>
            При смене склада список позиций будет пересоздан
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn btn-primary" onClick={handle} disabled={loading}>
            {loading ? '...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
}

function InventoryDetail({ inv, onRefresh }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scanInput, setScanInput] = useState('');
  const [qtyInput, setQtyInput] = useState('');
  const [search, setSearch] = useState('');
  const { show } = useToast();
  const scanRef = useRef(null);

  useEffect(() => {
    api(`/inventory/${inv.id}`).then(setDetail).finally(() => setLoading(false));
  }, [inv.id]);

  const handleStart = async () => {
    try {
      await api(`/inventory/${inv.id}/start`, { method:'POST' });
      show('Инвентаризация запущена', 'success');
      onRefresh();
      const d = await api(`/inventory/${inv.id}`);
      setDetail(d);
    } catch(err) { show(err.message, 'error'); }
  };

  const handleScan = async () => {
    if (!scanInput.trim()) return;
    try {
      const updated = await api(`/inventory/${inv.id}/scan`, {
        method:'POST',
        body: JSON.stringify({ sku: scanInput.trim(), quantity: qtyInput ? +qtyInput : undefined })
      });
      show(`${updated.product?.name}: ${updated.actualQty}`, 'success');
      setScanInput('');
      setQtyInput('');
      const d = await api(`/inventory/${inv.id}`);
      setDetail(d);
      scanRef.current?.focus();
    } catch(err) { show(err.message, 'error'); }
  };

  const handleComplete = async () => {
    if (!confirm('Завершить инвентаризацию? Все расхождения будут применены к остаткам.')) return;
    try {
      await api(`/inventory/${inv.id}/complete`, { method:'POST' });
      show('Инвентаризация завершена, остатки скорректированы', 'success');
      onRefresh();
      const d = await api(`/inventory/${inv.id}`);
      setDetail(d);
    } catch(err) { show(err.message, 'error'); }
  };

  const handleQtyChange = async (itemId, actualQty) => {
    // Inline update by scanning with explicit quantity
    const item = detail?.items.find(i => i.id === itemId);
    if (!item) return;
    try {
      await api(`/inventory/${inv.id}/scan`, {
        method:'POST',
        body: JSON.stringify({ sku: item.product.sku, quantity: +actualQty })
      });
      const d = await api(`/inventory/${inv.id}`);
      setDetail(d);
    } catch(err) { show(err.message, 'error'); }
  };

  if (loading) return <div style={{ padding:20, color:'var(--text3)' }}>Загрузка...</div>;
  if (!detail) return null;

  const filteredItems = detail.items?.filter(i =>
    !search || i.product?.name?.toLowerCase().includes(search.toLowerCase()) || i.product?.sku?.includes(search)
  );

  const totalDiscrepancy = detail.items?.reduce((s, i) => {
    const actual = i.actualQty ?? i.expectedQty;
    return s + (actual - i.expectedQty);
  }, 0);
  const mismatches = detail.items?.filter(i => i.actualQty != null && i.actualQty !== i.expectedQty).length || 0;

  return (
    <div style={{ marginTop:20 }}>
      {/* Header stats */}
      <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:16 }}>
        <div className="card" style={{ padding:'12px 18px', flex:1, minWidth:130 }}>
          <div style={{ fontSize:11, color:'var(--text3)', marginBottom:4, textTransform:'uppercase' }}>Позиций</div>
          <div style={{ fontSize:20, fontWeight:700 }}>{detail.items?.length || 0}</div>
        </div>
        <div className="card" style={{ padding:'12px 18px', flex:1, minWidth:130 }}>
          <div style={{ fontSize:11, color:'var(--text3)', marginBottom:4, textTransform:'uppercase' }}>Проверено</div>
          <div style={{ fontSize:20, fontWeight:700 }}>{detail.items?.filter(i => i.actualQty != null).length || 0}</div>
        </div>
        <div className="card" style={{ padding:'12px 18px', flex:1, minWidth:130 }}>
          <div style={{ fontSize:11, color:'var(--text3)', marginBottom:4, textTransform:'uppercase' }}>Расхождений</div>
          <div style={{ fontSize:20, fontWeight:700, color: mismatches > 0 ? 'var(--red)' : 'var(--green)' }}>{mismatches}</div>
        </div>
        <div className="card" style={{ padding:'12px 18px', flex:1, minWidth:130 }}>
          <div style={{ fontSize:11, color:'var(--text3)', marginBottom:4, textTransform:'uppercase' }}>Δ Итого</div>
          <div style={{ fontSize:20, fontWeight:700, color: totalDiscrepancy < 0 ? 'var(--red)' : totalDiscrepancy > 0 ? 'var(--yellow)' : 'var(--green)' }}>
            {totalDiscrepancy > 0 ? '+' : ''}{fmt(totalDiscrepancy)}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
        {detail.status === 'draft' && (
          <button className="btn btn-primary" onClick={handleStart}>
            <Play size={14} /> Запустить
          </button>
        )}
        {detail.status === 'in_progress' && (
          <>
            <div style={{ display:'flex', gap:6, flex:1, maxWidth:400 }}>
              <input
                ref={scanRef}
                className="form-input"
                style={{ flex:1 }}
                value={scanInput}
                onChange={e => setScanInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleScan()}
                placeholder="SKU или штрихкод..."
              />
              <input
                className="form-input"
                style={{ width:80 }}
                type="number"
                value={qtyInput}
                onChange={e => setQtyInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleScan()}
                placeholder="Кол-во"
              />
              <button className="btn btn-secondary" onClick={handleScan}><Scan size={14} /> Сканировать</button>
            </div>
            <button className="btn btn-danger" style={{ marginLeft:'auto' }} onClick={handleComplete}>
              <CheckSquare size={14} /> Завершить и применить
            </button>
          </>
        )}
      </div>

      {/* Search */}
      <div className="search-bar" style={{ marginBottom:12 }}>
        <Search size={15} className="search-icon" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по товару или SKU..." />
      </div>

      {/* Items table */}
      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Товар</th>
              <th>Ожидаемо</th>
              <th>Фактически</th>
              <th>Расхождение</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems?.map(item => {
              const actual = item.actualQty;
              const expected = item.expectedQty;
              const diff = actual != null ? actual - expected : null;
              return (
                <tr key={item.id}>
                  <td><span className="mono" style={{ fontSize:11 }}>{item.product?.sku}</span></td>
                  <td><strong>{item.product?.name}</strong></td>
                  <td style={{ color:'var(--text2)' }}>{fmt(expected)}</td>
                  <td>
                    {detail.status === 'in_progress' ? (
                      <input
                        type="number"
                        className="form-input"
                        style={{ width:80, padding:'4px 8px', fontSize:13 }}
                        defaultValue={actual ?? ''}
                        onBlur={e => {
                          const v = e.target.value;
                          if (v !== '' && +v !== actual) handleQtyChange(item.id, v);
                        }}
                        placeholder="—"
                      />
                    ) : (
                      <span style={{ color: actual == null ? 'var(--text3)' : 'var(--text)' }}>
                        {actual != null ? fmt(actual) : '—'}
                      </span>
                    )}
                  </td>
                  <td>
                    {diff != null ? (
                      <span style={{ fontWeight:700, color: diff < 0 ? 'var(--red)' : diff > 0 ? 'var(--yellow)' : 'var(--green)' }}>
                        {diff > 0 ? '+' : ''}{fmt(diff)}
                      </span>
                    ) : (
                      <span style={{ color:'var(--text3)' }}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function InventoryPage() {
  const [inventories, setInventories] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editModal, setEditModal] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const { show } = useToast();

  useEffect(() => {
    document.getElementById('page-title').textContent = 'Инвентаризация';
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    const [inv, wh] = await Promise.all([api('/inventory'), api('/warehouses').catch(()=>[])]);
    setInventories(inv);
    setWarehouses(wh);
    setLoading(false);
  };

  const handleDelete = async (inv, e) => {
    e.stopPropagation();
    if (!confirm(`Удалить инвентаризацию #${inv.id}? Это действие нельзя отменить.`)) return;
    try {
      await api(`/inventory/${inv.id}`, { method: 'DELETE' });
      show('Инвентаризация удалена', 'success');
      if (expanded === inv.id) setExpanded(null);
      load();
    } catch(err) { show(err.message, 'error'); }
  };

  if (loading) return <div className="loader"><div className="spinner" /></div>;

  return (
    <div>
      <TelegramReportButton />
      <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', marginBottom:20 }}>
        <button className="btn btn-primary" onClick={() => setModal(true)}>
          <Plus size={15} /> Новая инвентаризация
        </button>
      </div>

      {inventories.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h3>Инвентаризаций нет</h3>
            <p>Создайте первую инвентаризацию для сверки остатков</p>
          </div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {inventories.map(inv => (
            <div key={inv.id} className="card" style={{ padding:0, overflow:'hidden' }}>
              <div
                style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 18px', cursor:'pointer' }}
                onClick={() => setExpanded(expanded === inv.id ? null : inv.id)}
              >
                <span style={{ fontWeight:700, fontSize:15 }}>#{inv.id}</span>
                <span style={{ color:'var(--text2)', fontSize:13 }}>{inv.warehouse?.name}</span>
                <span style={{ fontSize:12, color:'var(--text3)' }}>{inv.type === 'full' ? 'Полная' : 'Частичная'}</span>
                <span style={{ fontSize:12, color:'var(--text3)' }}>{fmtDate(inv.createdAt || inv.id)}</span>
                <StatusBadge status={inv.status} />
                <span style={{ fontSize:12, color:'var(--text3)', marginLeft:'auto' }}>{inv._count?.items || 0} позиций</span>
                {inv.status === 'draft' && (
                  <>
                    <button
                      className="btn btn-ghost btn-icon"
                      title="Редактировать"
                      onClick={e => { e.stopPropagation(); setEditModal(inv); }}
                      style={{ padding:'4px 6px', color:'var(--text3)' }}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      className="btn btn-ghost btn-icon"
                      title="Удалить"
                      onClick={e => handleDelete(inv, e)}
                      style={{ padding:'4px 6px', color:'var(--red)' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
                {expanded === inv.id ? <ChevronUp size={16} style={{ color:'var(--text3)' }} /> : <ChevronDown size={16} style={{ color:'var(--text3)' }} />}
              </div>
              {expanded === inv.id && (
                <div style={{ borderTop:'1px solid var(--border)', padding:'0 18px 18px' }}>
                  <InventoryDetail inv={inv} onRefresh={load} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {modal && <NewInventoryModal warehouses={warehouses} onSave={() => { setModal(false); load(); }} onClose={() => setModal(false)} />}
      {editModal && <EditInventoryModal inv={editModal} warehouses={warehouses} onSave={() => { setEditModal(null); load(); }} onClose={() => setEditModal(null)} />}
    </div>
  );
}
