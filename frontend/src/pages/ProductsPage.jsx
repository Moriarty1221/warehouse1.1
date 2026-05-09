import React, { useEffect, useState, useRef } from 'react';
import { Plus, Search, Edit2, Trash2, Scan, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { api } from '../utils/api';
import { useToast } from '../hooks/useToast.jsx';

// Inline hint component
function Hint({ type = 'info', children }) {
  const colors = {
    info: { bg: 'rgba(0,180,216,0.08)', border: 'var(--accent)', color: 'var(--accent)', icon: <Info size={13}/> },
    warn: { bg: 'rgba(255,180,0,0.10)', border: 'var(--yellow,#f59e0b)', color: 'var(--yellow,#f59e0b)', icon: <AlertCircle size={13}/> },
    ok:   { bg: 'rgba(0,200,100,0.08)', border: 'var(--green,#22c55e)', color: 'var(--green,#22c55e)', icon: <CheckCircle size={13}/> },
  };
  const s = colors[type] || colors.info;
  return (
    <div style={{ display:'flex', alignItems:'flex-start', gap:6, marginTop:4, padding:'6px 10px', borderRadius:6, background:s.bg, border:'1px solid '+s.border, color:s.color, fontSize:12, lineHeight:1.4 }}>
      {s.icon}<span>{children}</span>
    </div>
  );
}

function FieldError({ msg }) {
  if (!msg) return null;
  return <div style={{ color:'var(--red,#ef4444)', fontSize:12, marginTop:3, display:'flex', alignItems:'center', gap:4 }}><AlertCircle size={11}/>{msg}</div>;
}

function ProductModal({ product, categories, onSave, onClose }) {
  const [form, setForm] = useState(
    product || { sku: '', name: '', categoryId: '', unit: 'пар', minStock: 0, price: 0, description: '' }
  );
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const { show } = useToast();

  const validate = () => {
    const e = {};
    if (!form.sku || !form.sku.trim()) e.sku = 'Введите SKU или штрихкод товара';
    else if (form.sku.trim().length < 2) e.sku = 'SKU слишком короткий (минимум 2 символа)';
    if (!form.name || !form.name.trim()) e.name = 'Введите наименование товара';
    else if (form.name.trim().length < 2) e.name = 'Наименование слишком короткое';
    if (form.price < 0) e.price = 'Цена не может быть отрицательной';
    if (form.minStock < 0) e.minStock = 'Минимальный остаток не может быть отрицательным';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      if (product?.id) await api('/products/' + product.id, { method: 'PUT', body: JSON.stringify(form) });
      else await api('/products', { method: 'POST', body: JSON.stringify(form) });
      show('Товар сохранён', 'success');
      onSave();
    } catch (err) { show(err.message, 'error'); }
    finally { setLoading(false); }
  };

  const isEdit = !!product?.id;

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">{isEdit ? 'Редактировать товар' : 'Новый товар'}</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">

          {!isEdit && (
            <Hint type="info">
              Заполните SKU (уникальный код) и наименование — они обязательны. SKU используется для поиска по сканеру штрихкода.
            </Hint>
          )}

          <div className="form-row" style={{ marginTop: 12 }}>
            <div className="form-group">
              <label className="form-label">SKU / Штрихкод *</label>
              <input
                className="form-input"
                value={form.sku}
                onChange={e => { setForm(p => ({ ...p, sku: e.target.value })); setErrors(v => ({ ...v, sku: '' })); }}
                placeholder="Например: 001234567890"
                style={errors.sku ? { borderColor: 'var(--red)' } : {}}
              />
              <FieldError msg={errors.sku} />
              {!errors.sku && form.sku.length > 0 && <Hint type="ok">SKU введён</Hint>}
            </div>
            <div className="form-group">
              <label className="form-label">Единица измерения</label>
              <select className="form-select" value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))}>
                {['пар', 'шт', 'кг', 'г', 'л', 'мл', 'м', 'упак', 'коробка'].map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Наименование *</label>
            <input
              className="form-input"
              value={form.name}
              onChange={e => { setForm(p => ({ ...p, name: e.target.value })); setErrors(v => ({ ...v, name: '' })); }}
              placeholder="Например: Nike Air Max 270 — 42р"
              style={errors.name ? { borderColor: 'var(--red)' } : {}}
            />
            <FieldError msg={errors.name} />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Категория</label>
              <select className="form-select" value={form.categoryId} onChange={e => setForm(p => ({ ...p, categoryId: e.target.value }))}>
                <option value="">Без категории</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {categories.length === 0 && <Hint type="warn">Категории не созданы. Можно добавить позже в разделе «Категории».</Hint>}
            </div>
            <div className="form-group">
              <label className="form-label">Мин. остаток</label>
              <input
                type="number"
                className="form-input"
                value={form.minStock}
                min={0}
                onChange={e => { setForm(p => ({ ...p, minStock: +e.target.value })); setErrors(v => ({ ...v, minStock: '' })); }}
              />
              <FieldError msg={errors.minStock} />
              <div style={{ fontSize:11, color:'var(--text3)', marginTop:3 }}>При достижении этого остатка — предупреждение на дашборде</div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">💰 Цена продажи (сом) *</label>
            <input
              type="number"
              className="form-input"
              value={form.price}
              min={0}
              onChange={e => { setForm(p => ({ ...p, price: +e.target.value })); setErrors(v => ({ ...v, price: '' })); }}
              placeholder="0"
              style={{ fontSize:16, fontWeight:700, ...(errors.price ? { borderColor:'var(--red)' } : {}) }}
            />
            <FieldError msg={errors.price} />
            {form.price === 0 && !errors.price && <Hint type="warn">Цена не указана — товар будет отмечен как «нет цены» в списке</Hint>}
            {form.price > 0 && <Hint type="ok">Цена: {new Intl.NumberFormat('ru-RU').format(form.price)} сом</Hint>}
          </div>

          <div className="form-group">
            <label className="form-label">Описание</label>
            <textarea
              className="form-textarea"
              value={form.description || ''}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Модель, размер, цвет, доп. характеристики..."
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading || !form.sku || !form.name}>
            {loading ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(true);
  const { show } = useToast();
  const barcodeRef = useRef('');
  const barcodeTimer = useRef(null);

  useEffect(() => {
    document.getElementById('page-title').textContent = 'Товары';
    load();
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'Enter') {
        if (barcodeRef.current.length > 3) setSearch(barcodeRef.current);
        barcodeRef.current = '';
      } else if (e.key.length === 1) {
        barcodeRef.current += e.key;
        clearTimeout(barcodeTimer.current);
        barcodeTimer.current = setTimeout(() => { barcodeRef.current = ''; }, 300);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const load = async () => {
    setLoading(true);
    const [p, c] = await Promise.all([api('/products'), api('/categories')]);
    setProducts(p);
    setCategories(c);
    setLoading(false);
  };

  const handleDelete = async (id, name) => {
    if (!confirm('Удалить товар "' + name + '"?\n\nЕсли у товара есть остатки на складах — удаление будет запрещено.')) return;
    try {
      await api('/products/' + id, { method: 'DELETE' });
      show('Товар удалён', 'success');
      load();
    } catch (err) { show(err.message, 'error'); }
  };

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const fmt = n => new Intl.NumberFormat('ru-RU').format(n);

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
        <div className="search-bar">
          <Search size={15} className="search-icon" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по названию или SKU..." />
        </div>
        <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
          <div style={{ fontSize:12, color:'var(--text3)', display:'flex', alignItems:'center', gap:5 }}>
            <Scan size={13} /> Сканер активен
          </div>
          <button className="btn btn-primary" onClick={() => setModal({})}>
            <Plus size={15} /> Добавить
          </button>
        </div>
      </div>

      {loading ? <div className="loader"><div className="spinner" /></div> : (
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          {filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">👟</div>
              <h3>Товары не найдены</h3>
              <p>Добавьте первый товар или измените поиск</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Наименование</th>
                  <th>Категория</th>
                  <th>Ед.</th>
                  <th>Цена продажи</th>
                  <th>Мин. ост.</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id}>
                    <td><span className="mono">{p.sku}</span></td>
                    <td><strong>{p.name}</strong></td>
                    <td>{p.category?.name || <span style={{ color:'var(--text3)' }}>—</span>}</td>
                    <td>{p.unit}</td>
                    <td>
                      <span style={{ fontWeight:700, color:p.price > 0 ? 'var(--accent2)' : 'var(--red)' }}>
                        {p.price > 0 ? fmt(p.price) + ' сом' : '⚠ нет цены'}
                      </span>
                    </td>
                    <td>{p.minStock}</td>
                    <td style={{ textAlign:'right' }}>
                      <div style={{ display:'flex', gap:4, justifyContent:'flex-end' }}>
                        <button className="btn btn-ghost btn-sm btn-icon" title="Редактировать" onClick={() => setModal(p)}><Edit2 size={14} /></button>
                        <button className="btn btn-danger btn-sm btn-icon" title="Удалить товар" onClick={() => handleDelete(p.id, p.name)}><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {modal !== null && (
        <ProductModal
          product={modal.id ? modal : null}
          categories={categories}
          onSave={() => { setModal(null); load(); }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
