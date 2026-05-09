import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { api } from '../utils/api';
import { useToast } from '../hooks/useToast.jsx';

function SupplierModal({ supplier, onSave, onClose }) {
  const [form, setForm] = useState(supplier || { name: '', contact: '', phone: '', email: '' });
  const [loading, setLoading] = useState(false);
  const { show } = useToast();

  const handleSave = async () => {
    setLoading(true);
    try {
      if (supplier?.id) await api(`/suppliers/${supplier.id}`, { method: 'PUT', body: JSON.stringify(form) });
      else await api('/suppliers', { method: 'POST', body: JSON.stringify(form) });
      show('Сохранено', 'success'); onSave();
    } catch (err) { show(err.message, 'error'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">{supplier?.id ? 'Редактировать' : 'Новый поставщик'}</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Название *</label>
            <input className="form-input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Контактное лицо</label>
            <input className="form-input" value={form.contact || ''} onChange={e => setForm(p => ({ ...p, contact: e.target.value }))} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Телефон</label>
              <input className="form-input" value={form.phone || ''} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+996 700 000 000" />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={form.email || ''} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
            </div>
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

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(true);
  const { show } = useToast();

  useEffect(() => {
    document.getElementById('page-title').textContent = 'Поставщики';
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    setSuppliers(await api('/suppliers'));
    setLoading(false);
  };

  const del = async (id) => {
    if (!confirm('Удалить?')) return;
    try { await api(`/suppliers/${id}`, { method: 'DELETE' }); load(); }
    catch (err) { show(err.message, 'error'); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
        <button className="btn btn-primary" onClick={() => setModal({})}><Plus size={15} /> Добавить</button>
      </div>
      {loading ? <div className="loader"><div className="spinner" /></div> : (
        <div className="card" style={{ padding: 0 }}>
          <table className="data-table">
            <thead><tr><th>Название</th><th>Контакт</th><th>Телефон</th><th>Email</th><th></th></tr></thead>
            <tbody>
              {suppliers.map(s => (
                <tr key={s.id}>
                  <td><strong>{s.name}</strong></td>
                  <td>{s.contact || '—'}</td>
                  <td>{s.phone || '—'}</td>
                  <td>{s.email || '—'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setModal(s)}><Edit2 size={14} /></button>
                      <button className="btn btn-danger btn-sm btn-icon" onClick={() => del(s.id)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {suppliers.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>Поставщиков нет</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {modal !== null && <SupplierModal supplier={modal?.id ? modal : null} onSave={() => { setModal(null); load(); }} onClose={() => setModal(null)} />}
    </div>
  );
}
