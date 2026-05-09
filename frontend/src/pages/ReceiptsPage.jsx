import React, { useEffect, useState } from 'react';
import { Plus, Check, Trash2, Scan, Pencil, X } from 'lucide-react';
import { api } from '../utils/api';
import { useToast } from '../hooks/useToast.jsx';
import { useAuth } from '../hooks/useAuth.jsx';

function ReceiptModal({ warehouses, suppliers, products, onSave, onClose, user }) {
  const [form, setForm] = useState({ warehouseId: user?.warehouseId || '', supplierId: '', notes: '', items: [] });
  const [loading, setLoading] = useState(false);
  const [scan, setScan] = useState('');
  const { show } = useToast();

  const addItem = (product) => {
    setForm(p => {
      const existing = p.items.find(i => i.productId === product.id);
      if (existing) return { ...p, items: p.items.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i) };
      return { ...p, items: [...p.items, { productId: product.id, product, quantity: 1, costPerUnit: 0 }] };
    });
  };

  const handleScan = (e) => {
    if (e.key === 'Enter' && scan.trim()) {
      const product = products.find(p => p.sku === scan.trim());
      if (product) { addItem(product); setScan(''); }
      else { show('Товар не найден: ' + scan, 'error'); setScan(''); }
    }
  };

  const handleSave = async () => {
    if (!form.warehouseId || form.items.length === 0) return show('Заполните все поля', 'error');
    setLoading(true);
    try {
      await api('/receipts', { method: 'POST', body: JSON.stringify({ ...form, warehouseId: +form.warehouseId, supplierId: form.supplierId ? +form.supplierId : null }) });
      show('Приход создан', 'success'); onSave();
    } catch (err) { show(err.message, 'error'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 680 }}>
        <div className="modal-header">
          <div className="modal-title">Новый приход</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Склад *</label>
              <select className="form-select" value={form.warehouseId} onChange={e => setForm(p => ({ ...p, warehouseId: e.target.value }))}>
                <option value="">Выберите склад</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Поставщик</label>
              <select className="form-select" value={form.supplierId} onChange={e => setForm(p => ({ ...p, supplierId: e.target.value }))}>
                <option value="">Без поставщика</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label"><Scan size={12} style={{ display: 'inline', marginRight: 4 }} />Сканировать штрихкод</label>
            <input className="form-input" value={scan} onChange={e => setScan(e.target.value)} onKeyDown={handleScan} placeholder="Наведите сканер или введите SKU + Enter" />
          </div>
          <div className="form-group">
            <label className="form-label">Добавить товар</label>
            <select className="form-select" onChange={e => { const p = products.find(x => x.id === +e.target.value); if (p) addItem(p); e.target.value = ''; }}>
              <option value="">Выберите товар...</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
            </select>
          </div>
          {form.items.length > 0 && (
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
              <table className="data-table">
                <thead><tr><th>Товар</th><th>Количество</th><th>Цена</th><th>Сумма</th><th></th></tr></thead>
                <tbody>
                  {form.items.map((item, i) => (
                    <tr key={i}>
                      <td>{item.product.name}</td>
                      <td><input type="number" className="form-input" style={{ width: 80 }} value={item.quantity} onChange={e => setForm(p => ({ ...p, items: p.items.map((x, j) => j === i ? { ...x, quantity: +e.target.value } : x) }))} /></td>
                      <td><input type="number" className="form-input" style={{ width: 100 }} value={item.costPerUnit} onChange={e => setForm(p => ({ ...p, items: p.items.map((x, j) => j === i ? { ...x, costPerUnit: +e.target.value } : x) }))} /></td>
                      <td>{(item.quantity * item.costPerUnit).toFixed(2)}</td>
                      <td><button className="btn btn-danger btn-sm btn-icon" onClick={() => setForm(p => ({ ...p, items: p.items.filter((_, j) => j !== i) }))}>✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Примечание</label>
            <textarea className="form-textarea" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Необязательно" />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading}>{loading ? 'Сохранение...' : 'Создать'}</button>
        </div>
      </div>
    </div>
  );
}

function EditReceiptModal({ receipt, suppliers, onSave, onClose }) {
  const [notes, setNotes] = useState(receipt.notes || '');
  const [supplierId, setSupplierId] = useState(receipt.supplierId || '');
  const [loading, setLoading] = useState(false);
  const { show } = useToast();

  const handleSave = async () => {
    setLoading(true);
    try {
      await api(`/receipts/${receipt.id}`, { method: 'PUT', body: JSON.stringify({ notes, supplierId: supplierId ? +supplierId : null }) });
      show('Приход обновлён', 'success'); onSave();
    } catch (err) { show(err.message, 'error'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <div className="modal-title">Редактировать приход #{receipt.id}</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: 'var(--text2)' }}>
            📦 {receipt.items?.length} позиций • {receipt.warehouse?.name} • {new Date(receipt.date).toLocaleDateString('ru-RU')}
          </div>
          <div className="form-group">
            <label className="form-label">Поставщик</label>
            <select className="form-select" value={supplierId} onChange={e => setSupplierId(e.target.value)}>
              <option value="">Без поставщика</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Примечание</label>
            <textarea className="form-textarea" value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading}>{loading ? 'Сохранение...' : 'Сохранить'}</button>
        </div>
      </div>
    </div>
  );
}

export default function ReceiptsPage() {
  const { user } = useAuth();
  const [receipts, setReceipts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [modal, setModal] = useState(false);
  const [editModal, setEditModal] = useState(null);
  const [loading, setLoading] = useState(true);
  const { show } = useToast();
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    document.getElementById('page-title').textContent = 'Приход товаров';
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    const wid = user?.role !== 'admin' && user?.warehouseId ? `?warehouseId=${user.warehouseId}` : '';
    const [r, w, s, p] = await Promise.all([api(`/receipts${wid}`), api('/warehouses'), api('/suppliers'), api('/products')]);
    setReceipts(r); setWarehouses(w); setSuppliers(s); setProducts(p);
    setLoading(false);
  };

  const confirmReceipt = async (id) => {
    try { await api(`/receipts/${id}/confirm`, { method: 'POST' }); show('Приход подтверждён — остатки обновлены', 'success'); load(); }
    catch (err) { show(err.message, 'error'); }
  };

  const del = async (id, status) => {
    const msg = status === 'confirmed' && isAdmin
      ? 'Удалить ПОДТВЕРЖДЁННЫЙ приход? Остатки будут уменьшены обратно!'
      : 'Удалить черновик прихода?';
    if (!window.confirm(msg)) return;
    try { await api(`/receipts/${id}`, { method: 'DELETE' }); show('Удалено', 'success'); load(); }
    catch (err) { show(err.message, 'error'); }
  };

  const statusLabel = (s) => ({
    draft: <span className="badge badge-yellow">Черновик</span>,
    confirmed: <span className="badge badge-green">Подтверждён</span>,
    cancelled: <span className="badge badge-gray">Отменён</span>,
  }[s]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
        <button className="btn btn-primary" onClick={() => setModal(true)}><Plus size={15} /> Новый приход</button>
      </div>

      {loading ? <div className="loader"><div className="spinner" /></div> : (
        <div className="card" style={{ padding: 0 }}>
          <table className="data-table">
            <thead>
              <tr><th>#</th><th>Дата</th><th>Склад</th><th>Поставщик</th><th>Товаров</th><th>Примечание</th><th>Статус</th><th></th></tr>
            </thead>
            <tbody>
              {receipts.map(r => (
                <tr key={r.id}>
                  <td className="mono">#{r.id}</td>
                  <td>{new Date(r.date).toLocaleDateString('ru-RU')}</td>
                  <td>{r.warehouse.name}</td>
                  <td>{r.supplier?.name || '—'}</td>
                  <td>{r.items.length} поз.</td>
                  <td style={{ color: 'var(--text3)', fontSize: 12, maxWidth: 180 }}>{r.notes || '—'}</td>
                  <td>{statusLabel(r.status)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      {r.status === 'draft' && (
                        <button className="btn btn-success btn-sm" onClick={() => confirmReceipt(r.id)}><Check size={13} /> Подтвердить</button>
                      )}
                      {isAdmin && (
                        <button className="btn btn-ghost btn-sm btn-icon" title="Редактировать" onClick={() => setEditModal(r)}><Pencil size={13} /></button>
                      )}
                      {(r.status === 'draft' || isAdmin) && (
                        <button className="btn btn-danger btn-sm btn-icon" title="Удалить" onClick={() => del(r.id, r.status)}><Trash2 size={13} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {receipts.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>Приходов нет</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {modal && <ReceiptModal warehouses={warehouses} suppliers={suppliers} products={products} user={user} onSave={() => { setModal(false); load(); }} onClose={() => setModal(false)} />}
      {editModal && <EditReceiptModal receipt={editModal} suppliers={suppliers} onSave={() => { setEditModal(null); load(); }} onClose={() => setEditModal(null)} />}
    </div>
  );
}
