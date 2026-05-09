import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { api } from '../utils/api';
import { useToast } from '../hooks/useToast.jsx';

function WarehouseModal({ warehouse, onSave, onClose }) {
  const [form, setForm] = useState(warehouse || { name: '', address: '', description: '' });
  const [loading, setLoading] = useState(false);
  const { show } = useToast();

  const handleSave = async () => {
    setLoading(true);
    try {
      if (warehouse?.id) await api(`/warehouses/${warehouse.id}`, { method: 'PUT', body: JSON.stringify(form) });
      else await api('/warehouses', { method: 'POST', body: JSON.stringify(form) });
      show('Сохранено', 'success'); onSave();
    } catch (err) { show(err.message, 'error'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">{warehouse?.id ? 'Редактировать склад' : 'Новый склад'}</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Название *</label>
            <input className="form-input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Основной склад" />
          </div>
          <div className="form-group">
            <label className="form-label">Адрес</label>
            <input className="form-input" value={form.address || ''} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="ул. Примерная, 1" />
          </div>
          <div className="form-group">
            <label className="form-label">Описание</label>
            <textarea className="form-textarea" value={form.description || ''} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading || !form.name}>Сохранить</button>
        </div>
      </div>
    </div>
  );
}

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState([]);
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(true);
  const { show } = useToast();

  useEffect(() => {
    document.getElementById('page-title').textContent = 'Склады';
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    setWarehouses(await api('/warehouses'));
    setLoading(false);
  };

  const del = async (id) => {
    if (!confirm('Деактивировать склад?')) return;
    try { await api(`/warehouses/${id}`, { method: 'DELETE' }); load(); }
    catch (err) { show(err.message, 'error'); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
        <button className="btn btn-primary" onClick={() => setModal({})}><Plus size={15} /> Добавить склад</button>
      </div>
      {loading ? <div className="loader"><div className="spinner" /></div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {warehouses.map(w => (
            <div key={w.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 24 }}>🏭</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setModal(w)}><Edit2 size={14} /></button>
                  <button className="btn btn-danger btn-sm btn-icon" onClick={() => del(w.id)}><Trash2 size={14} /></button>
                </div>
              </div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{w.name}</div>
              {w.address && <div style={{ color: 'var(--text2)', fontSize: 13 }}>📍 {w.address}</div>}
              {w.description && <div style={{ color: 'var(--text3)', fontSize: 12, marginTop: 6 }}>{w.description}</div>}
              <div style={{ marginTop: 10 }}>{w.isActive ? <span className="badge badge-green">Активен</span> : <span className="badge badge-gray">Неактивен</span>}</div>
            </div>
          ))}
          {warehouses.length === 0 && <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 60, color: 'var(--text3)' }}>Складов нет</div>}
        </div>
      )}
      {modal !== null && <WarehouseModal warehouse={modal?.id ? modal : null} onSave={() => { setModal(null); load(); }} onClose={() => setModal(null)} />}
    </div>
  );
}
