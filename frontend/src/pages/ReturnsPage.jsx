import React, { useEffect, useState } from 'react';
import { RotateCcw, Plus, Search, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { api } from '../utils/api';
import { useToast } from '../hooks/useToast.jsx';
import { useAuth } from '../hooks/useAuth.jsx';

const fmt = n => new Intl.NumberFormat('ru-RU').format(Number(n || 0));
const fmtDate = d => d ? new Date(d).toLocaleString('ru-RU', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';

const REASONS = [
  { value: 'defect', label: 'Брак / Дефект' },
  { value: 'wrong_item', label: 'Неверный товар' },
  { value: 'wrong_size', label: 'Не тот размер' },
  { value: 'customer_change', label: 'Передумал покупатель' },
  { value: 'other', label: 'Другое' },
];

const CONDITIONS = [
  { value: 'good', label: '✅ Хорошее — вернуть на склад' },
  { value: 'damaged', label: '⚠️ Повреждён — вернуть на склад' },
  { value: 'written_off', label: '❌ Списать — не восстанавливать' },
];

function NewReturnModal({ warehouses, onSave, onClose }) {
  const [form, setForm] = useState({
    saleId: '', warehouseId: warehouses[0]?.id || '', reason: 'defect',
    reasonNote: '', refundMethod: 'cash', refundAmount: 0, condition: 'good'
  });
  const [items, setItems] = useState([{ productId:'', quantity:1, refundPrice:0 }]);
  const [products, setProducts] = useState([]);
  const [saleSearch, setSaleSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const { show } = useToast();

  useEffect(() => { api('/products').then(setProducts).catch(() => {}); }, []);

  const addItem = () => setItems(prev => [...prev, { productId:'', quantity:1, refundPrice:0 }]);
  const removeItem = i => setItems(prev => prev.filter((_, idx) => idx !== i));
  const updateItem = (i, field, val) => setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: val } : item));

  const totalRefund = items.reduce((s, i) => s + (i.quantity * i.refundPrice), 0);

  const handle = async () => {
    const validItems = items.filter(i => i.productId && i.quantity > 0);
    if (validItems.length === 0) return show('Добавьте хотя бы один товар', 'error');
    if (!form.warehouseId) return show('Выберите склад', 'error');
    setLoading(true);
    try {
      await api('/returns', {
        method:'POST',
        body: JSON.stringify({
          ...form,
          saleId: form.saleId ? +form.saleId : undefined,
          warehouseId: +form.warehouseId,
          refundAmount: +form.refundAmount || totalRefund,
          items: validItems.map(i => ({ productId:+i.productId, quantity:+i.quantity, refundPrice:+i.refundPrice }))
        })
      });
      show('Возврат оформлен', 'success');
      onSave();
    } catch(err) { show(err.message, 'error'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth:560 }}>
        <div className="modal-header">
          <div className="modal-title">Новый возврат</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ maxHeight:'70vh', overflowY:'auto' }}>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">№ Чека (необязательно)</label>
              <input className="form-input" value={form.saleId} onChange={e => setForm(p=>({...p, saleId:e.target.value}))} placeholder="ID чека из системы" />
              <div style={{ fontSize:11, color:'var(--text3)', marginTop:3 }}>Оставьте пустым для возврата без чека (только менеджер/админ)</div>
            </div>
            <div className="form-group">
              <label className="form-label">Склад</label>
              <select className="form-select" value={form.warehouseId} onChange={e => setForm(p=>({...p,warehouseId:e.target.value}))}>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Причина возврата</label>
              <select className="form-select" value={form.reason} onChange={e => setForm(p=>({...p,reason:e.target.value}))}>
                {REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Способ возврата денег</label>
              <select className="form-select" value={form.refundMethod} onChange={e => setForm(p=>({...p,refundMethod:e.target.value}))}>
                <option value="cash">Наличные</option>
                <option value="card">Карта</option>
                <option value="store_credit">Обмен/зачёт</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Состояние товара</label>
            <select className="form-select" value={form.condition} onChange={e => setForm(p=>({...p,condition:e.target.value}))}>
              {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Комментарий</label>
            <input className="form-input" value={form.reasonNote} onChange={e => setForm(p=>({...p,reasonNote:e.target.value}))} placeholder="Необязательно..." />
          </div>

          {/* Items */}
          <div style={{ borderTop:'1px solid var(--border)', paddingTop:14, marginTop:4 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
              <span style={{ fontWeight:600, fontSize:13 }}>Товары к возврату</span>
              <button className="btn btn-secondary btn-sm" onClick={addItem}><Plus size={13} /> Добавить</button>
            </div>
            {items.map((item, i) => (
              <div key={i} style={{ display:'flex', gap:8, marginBottom:8, alignItems:'flex-end' }}>
                <div className="form-group" style={{ flex:2, margin:0 }}>
                  <label className="form-label" style={{ fontSize:11 }}>Товар</label>
                  <select className="form-select" value={item.productId} onChange={e => updateItem(i, 'productId', e.target.value)}>
                    <option value="">— выберите —</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ width:80, margin:0 }}>
                  <label className="form-label" style={{ fontSize:11 }}>Кол-во</label>
                  <input type="number" className="form-input" min={1} value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} />
                </div>
                <div className="form-group" style={{ width:110, margin:0 }}>
                  <label className="form-label" style={{ fontSize:11 }}>Цена возврата</label>
                  <input type="number" className="form-input" min={0} value={item.refundPrice} onChange={e => updateItem(i, 'refundPrice', e.target.value)} />
                </div>
                <button className="btn btn-danger btn-sm btn-icon" onClick={() => removeItem(i)} style={{ flexShrink:0 }}>✕</button>
              </div>
            ))}
            <div style={{ textAlign:'right', fontSize:13, color:'var(--accent)', fontWeight:700, marginTop:6 }}>
              Итого к возврату: {fmt(totalRefund)} сом
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn btn-primary" onClick={handle} disabled={loading}>
            <RotateCcw size={14} /> {loading ? '...' : 'Оформить возврат'}
          </button>
        </div>
      </div>
    </div>
  );
}

const CONDITION_LABELS = { good: '✅ Хорошее', damaged: '⚠️ Повреждён', written_off: '❌ Списан' };
const REASON_LABELS = { defect: 'Брак', wrong_item: 'Неверный товар', wrong_size: 'Не тот размер', customer_change: 'Передумал', other: 'Другое' };
const REFUND_LABELS = { cash: 'Наличные', card: 'Карта', store_credit: 'Зачёт' };

export default function ReturnsPage() {
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [warehouses, setWarehouses] = useState([]);
  const [search, setSearch] = useState('');
  const { show } = useToast();

  useEffect(() => {
    document.getElementById('page-title').textContent = 'Возвраты';
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    const [r, w] = await Promise.all([api('/returns'), api('/warehouses').catch(()=>[])]);
    setReturns(r);
    setWarehouses(w);
    setLoading(false);
  };

  const filtered = returns.filter(r =>
    !search ||
    r.id?.toString().includes(search) ||
    r.items?.some(i => i.product?.name?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
        <div className="search-bar">
          <Search size={15} className="search-icon" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по ID или товару..." />
        </div>
        <button className="btn btn-primary" style={{ marginLeft:'auto' }} onClick={() => setModal(true)}>
          <Plus size={15} /> Новый возврат
        </button>
      </div>

      {loading ? <div className="loader"><div className="spinner" /></div> : (
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          {filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🔄</div>
              <h3>Возвратов нет</h3>
              <p>Оформите первый возврат через кнопку выше</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Дата</th>
                  <th>Товары</th>
                  <th>Причина</th>
                  <th>Состояние</th>
                  <th>Чек</th>
                  <th>Сумма возврата</th>
                  <th>Способ</th>
                  <th>Склад восстановлен</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id}>
                    <td><span className="mono">#{r.id}</span></td>
                    <td style={{ fontSize:12, color:'var(--text2)' }}>{fmtDate(r.createdAt)}</td>
                    <td>
                      {r.items?.map(i => (
                        <div key={i.id} style={{ fontSize:12 }}>{i.product?.name} × {i.quantity}</div>
                      ))}
                    </td>
                    <td style={{ fontSize:12 }}>{REASON_LABELS[r.reason] || r.reason}</td>
                    <td style={{ fontSize:12 }}>{CONDITION_LABELS[r.condition] || r.condition}</td>
                    <td style={{ fontSize:12, color:'var(--text3)' }}>{r.sale?.receiptNumber || '—'}</td>
                    <td><span style={{ fontWeight:700, color:'var(--accent2,var(--yellow))' }}>{fmt(r.refundAmount)} сом</span></td>
                    <td style={{ fontSize:12 }}>{REFUND_LABELS[r.refundMethod] || r.refundMethod}</td>
                    <td>
                      {r.stockRestored
                        ? <span style={{ color:'var(--green)', fontSize:12 }}>✅ Да</span>
                        : <span style={{ color:'var(--red)', fontSize:12 }}>❌ Нет</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {modal && <NewReturnModal warehouses={warehouses} onSave={() => { setModal(false); load(); }} onClose={() => setModal(false)} />}
    </div>
  );
}
