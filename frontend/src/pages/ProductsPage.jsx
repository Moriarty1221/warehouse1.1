import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Package } from 'lucide-react';
import { api } from '../utils/api';
import { useToast } from '../hooks/useToast.jsx';
import CreatableSelect from 'react-select/creatable';

const POPULAR_MODELS = [
  "GUCCI", "T10", "HERMESS КРОСС", "ADIDAS ТП", "UNCLOUD", "MIU",
  "CHANEL", "RICK OWENS", "VENETA", "NEW BALANCE", "SUPER STAR",
  "NIKE КЕДЫ 1", "NIKE КЕДЫ 2", "NIKE СЕТКА", "ADIDAS КЕДЫ",
  "HERMES КЕДЫ", "PUMA", "YEEZY", "BALENCIAGA", "LOUIS VUITTON"
];

function ProductModal({ product, onSave, onClose }) {
  const [form, setForm] = useState({
    sku: '',
    name: '',
    brand: '',
    salePrice: 0,
    costPrice: 0,
    description: '',
    sizes: []
  });
  const [newSize, setNewSize] = useState('');
  const [newQty, setNewQty] = useState(1);
  const [loading, setLoading] = useState(false);
  const { show } = useToast();

  useEffect(() => {
    if (product) {
      setForm({
        ...product,
        sizes: product.sizes || []
      });
    }
  }, [product]);

  const addSize = () => {
    if (!newSize.trim()) return;
    const sizeTrim = newSize.trim();
    setForm(prev => {
      const existing = prev.sizes.findIndex(s => s.size === sizeTrim);
      if (existing !== -1) {
        const updated = [...prev.sizes];
        updated[existing].quantity += +newQty;
        return { ...prev, sizes: updated };
      }
      return {
        ...prev,
        sizes: [...prev.sizes, { size: sizeTrim, quantity: +newQty }]
      };
    });
    setNewSize('');
    setNewQty(1);
  };

  const removeSize = (sizeToRemove) => {
    setForm(prev => ({
      ...prev,
      sizes: prev.sizes.filter(s => s.size !== sizeToRemove)
    }));
  };

  const handleSave = async () => {
    if (!form.sku || !form.name) {
      return show('SKU и Название модели обязательны', 'error');
    }
    if (form.sizes.length === 0) {
      return show('Добавьте хотя бы один размер', 'error');
    }

    setLoading(true);
    try {
      const method = product?.id ? 'PUT' : 'POST';
      const url = product?.id ? `/products/${product.id}` : '/products';
      
      await api(url, {
        method,
        body: JSON.stringify(form)
      });

      show('Товар успешно сохранён', 'success');
      onSave();
      onClose();
    } catch (err) {
      show(err.message || 'Ошибка сохранения', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: '620px', width: '95%' }}>
        <div className="modal-header">
          <div className="modal-title">{product ? 'Редактировать товар' : 'Новый товар'}</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="form-row">
            <div className="form-group">
              <label>SKU *</label>
              <input 
                className="form-input" 
                value={form.sku} 
                onChange={e => setForm(p => ({...p, sku: e.target.value.toUpperCase()}))} 
                placeholder="UB22-40"
              />
            </div>
            <div className="form-group" style={{flex: 1}}>
              <label>Модель (Название) *</label>
              <CreatableSelect
                options={POPULAR_MODELS.map(m => ({ value: m, label: m }))}
                value={form.name ? { value: form.name, label: form.name } : null}
                onChange={option => setForm(p => ({ ...p, name: option?.value || '' }))}
                placeholder="Выберите или введите модель..."
                isClearable
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Бренд</label>
              <input className="form-input" value={form.brand || ''} onChange={e => setForm(p => ({...p, brand: e.target.value}))} />
            </div>
            <div className="form-group">
              <label>Цена продажи (сом)</label>
              <input type="number" className="form-input" value={form.salePrice} onChange={e => setForm(p => ({...p, salePrice: +e.target.value}))} />
            </div>
          </div>

          {/* Размеры */}
          <div className="form-group">
            <label style={{marginBottom: '8px', display: 'block'}}>Размеры и количество</label>
            
            <div style={{display: 'flex', gap: '8px', marginBottom: '12px'}}>
              <input 
                placeholder="Размер (например 42)" 
                value={newSize} 
                onChange={e => setNewSize(e.target.value)} 
                style={{width: '140px'}}
              />
              <input 
                type="number" 
                placeholder="Кол-во" 
                value={newQty} 
                onChange={e => setNewQty(e.target.value)} 
                style={{width: '100px'}}
              />
              <button className="btn btn-primary" onClick={addSize}>+ Добавить размер</button>
            </div>

            {form.sizes.length > 0 && (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Размер</th>
                    <th>Количество</th>
                    <th style={{width: '60px'}}></th>
                  </tr>
                </thead>
                <tbody>
                  {form.sizes.map((s, i) => (
                    <tr key={i}>
                      <td><strong>{s.size}</strong></td>
                      <td>{s.quantity}</td>
                      <td>
                        <button className="btn btn-danger btn-sm" onClick={() => removeSize(s.size)}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
            {loading ? 'Сохранение...' : 'Сохранить товар'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const { show } = useToast();

  useEffect(() => {
    document.getElementById('page-title').textContent = 'Товары';
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api('/products');
      setProducts(data);
    } catch (e) {
      show('Ошибка загрузки товаров', 'error');
    }
    setLoading(false);
  };

  const filtered = products.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase()) ||
    p.brand?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="search-bar" style={{ flex: 1 }}>
          <input 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            placeholder="Поиск по модели, SKU или бренду..." 
          />
        </div>
        <button className="btn btn-primary" onClick={() => setModal({})}>
          <Plus size={16} /> Добавить товар
        </button>
      </div>

      {loading ? (
        <div className="loader"><div className="spinner" /></div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
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
              {filtered.map(p => {
                const totalQty = p.sizes ? p.sizes.reduce((sum, s) => sum + s.quantity, 0) : 0;
                return (
                  <tr key={p.id}>
                    <td className="mono">{p.sku}</td>
                    <td><strong>{p.name}</strong></td>
                    <td>{p.brand || '—'}</td>
                    <td style={{ fontSize: '13px', color: '#888' }}>
                      {p.sizes && p.sizes.length > 0 
                        ? p.sizes.map(s => `${s.size}×${s.quantity}`).join(' • ')
                        : '—'}
                    </td>
                    <td style={{ fontWeight: 700 }}>{totalQty}</td>
                    <td>{p.salePrice} сом</td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => setModal(p)}>
                        <Edit2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text3)' }}>
                    Товары не найдены
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {modal && <ProductModal product={modal} onSave={load} onClose={() => setModal(null)} />}
    </div>
  );
}
