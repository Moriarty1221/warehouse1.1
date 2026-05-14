import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { api } from '../utils/api';
import { useToast } from '../hooks/useToast.jsx';
import CreatableSelect from 'react-select/creatable';

const POPULAR_MODELS = [
  "GUCCI", "T10", "HERMESS КРОСС", "ADIDAS ТП", "UNCLOUD", "MIU1", "MIU2",
  "CHANEL", "RICK OWENS", "VENETA", "NEW BALANCE", "SUPER STAR",
  "NIKE КЕДЫ 1", "NIKE КЕДЫ 2", "NIKE СЕТКА", "ADIDAS КЕДЫ", "HERMES КЕДЫ"
];

function ProductModal({ product, onSave, onClose }) {
  const [form, setForm] = useState(product || { sku: '', name: '', brand: '', salePrice: 0, costPrice: 0, sizes: [] });
  const [newSize, setNewSize] = useState('');
  const [newQty, setNewQty] = useState(1);
  const { show } = useToast();

  const addSize = () => {
    if (!newSize) return;
    setForm(p => ({
      ...p,
      sizes: [...p.sizes.filter(s => s.size !== newSize), { size: newSize, quantity: +newQty }]
    }));
    setNewSize('');
    setNewQty(1);
  };

  const removeSize = (size) => {
    setForm(p => ({ ...p, sizes: p.sizes.filter(s => s.size !== size) }));
  };

  const handleSave = async () => {
    if (!form.sku || !form.name) return show('SKU и название обязательны', 'error');
    try {
      await api('/products', { method: product ? 'PUT' : 'POST', body: JSON.stringify(form) });
      show('Товар сохранён', 'success');
      onSave();
      onClose();
    } catch (e) { show(e.message, 'error'); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <div className="modal-title">{product ? 'Редактировать' : 'Новый товар'}</div>
          <button onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-row">
            <div className="form-group">
              <label>SKU *</label>
              <input value={form.sku} onChange={e => setForm(p => ({...p, sku: e.target.value}))} />
            </div>
            <div className="form-group">
              <label>Модель / Название *</label>
              <CreatableSelect
                options={POPULAR_MODELS.map(m => ({value: m, label: m}))}
                onChange={(opt) => setForm(p => ({...p, name: opt?.value || ''}))}
                value={form.name ? {value: form.name, label: form.name} : null}
                placeholder="Выберите или введите модель"
                isClearable
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Бренд</label>
              <input value={form.brand || ''} onChange={e => setForm(p => ({...p, brand: e.target.value}))} />
            </div>
            <div className="form-group">
              <label>Цена продажи</label>
              <input type="number" value={form.salePrice} onChange={e => setForm(p => ({...p, salePrice: +e.target.value}))} />
            </div>
          </div>

          {/* Размеры */}
          <div className="form-group">
            <label>Размеры и количество</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input placeholder="Размер (40)" value={newSize} onChange={e => setNewSize(e.target.value)} style={{width: '100px'}} />
              <input type="number" placeholder="Кол-во" value={newQty} onChange={e => setNewQty(e.target.value)} style={{width: '80px'}} />
              <button className="btn btn-primary" onClick={addSize}>Добавить</button>
            </div>

            <table className="data-table">
              <thead><tr><th>Размер</th><th>Количество</th><th></th></tr></thead>
              <tbody>
                {form.sizes.map((s, i) => (
                  <tr key={i}>
                    <td>{s.size}</td>
                    <td>{s.quantity}</td>
                    <td><button onClick={() => removeSize(s.size)} className="btn btn-danger btn-sm">✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose}>Отмена</button>
          <button className="btn btn-primary" onClick={handleSave}>Сохранить</button>
        </div>
      </div>
    </div>
  );
}

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(true);
  const { show } = useToast();

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const data = await api('/products');
    setProducts(data);
    setLoading(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
        <button className="btn btn-primary" onClick={() => setModal({})}>
          <Plus size={15} /> Новый товар
        </button>
      </div>

      {loading ? <div className="loader" /> : (
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Модель</th>
                <th>Бренд</th>
                <th>Размеры</th>
                <th>Общий остаток</th>
                <th>Цена</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => {
                const total = p.sizes.reduce((sum, s) => sum + s.quantity, 0);
                return (
                  <tr key={p.id}>
                    <td className="mono">{p.sku}</td>
                    <td><strong>{p.name}</strong></td>
                    <td>{p.brand}</td>
                    <td>{p.sizes.map(s => `${s.size}×${s.quantity}`).join(' • ')}</td>
                    <td><strong>{total}</strong></td>
                    <td>{p.salePrice} сом</td>
                    <td>
                      <button onClick={() => setModal(p)}><Edit2 size={14} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal && <ProductModal product={modal} onSave={load} onClose={() => setModal(null)} />}
    </div>
  );
}
