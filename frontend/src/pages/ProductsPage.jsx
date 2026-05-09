import React, { useEffect, useState, useRef } from 'react';
import { Plus, Search, Edit2, Trash2, Scan, AlertCircle, CheckCircle, Info, Grid, ChevronDown, ChevronUp, Package } from 'lucide-react';
import { api } from '../utils/api';
import { useToast } from '../hooks/useToast.jsx';

// Стандартные размеры обуви
const SHOE_SIZES_EU = [
  '34','35','36','37','38','39','40','41','42','43','44','45','46','47','48'
];

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

// ─── Размерная сетка (просмотр остатков по размерам одной модели) ───
function SizeGrid({ modelCode, warehouseId }) {
  const [sizes, setSizes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!modelCode) return;
    setLoading(true);
    api(`/products/model/${encodeURIComponent(modelCode)}${warehouseId ? `?warehouseId=${warehouseId}` : ''}`)
      .then(setSizes)
      .catch(() => setSizes([]))
      .finally(() => setLoading(false));
  }, [modelCode, warehouseId]);

  if (loading) return <div style={{ padding:'8px 0', color:'var(--text3)', fontSize:12 }}>Загрузка...</div>;
  if (sizes.length === 0) return <div style={{ padding:'8px 0', color:'var(--text3)', fontSize:12 }}>Нет размеров для этой модели</div>;

  const totalStock = sizes.reduce((s, p) => {
    const qty = p.stock?.reduce((a, st) => a + st.quantity, 0) || 0;
    return s + qty;
  }, 0);

  return (
    <div style={{ marginTop:8 }}>
      {/* Размерная сетка */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8 }}>
        {sizes.map(p => {
          const qty = p.stock?.reduce((a, st) => a + st.quantity, 0) || 0;
          const isEmpty = qty === 0;
          const isLow = qty > 0 && qty <= p.minStock;
          return (
            <div key={p.id} style={{
              display:'flex', flexDirection:'column', alignItems:'center',
              padding:'6px 10px', borderRadius:8, minWidth:52,
              background: isEmpty ? 'rgba(255,77,109,0.08)' : isLow ? 'rgba(255,179,0,0.1)' : 'rgba(0,212,170,0.08)',
              border: `1px solid ${isEmpty ? 'rgba(255,77,109,0.3)' : isLow ? 'rgba(255,179,0,0.35)' : 'rgba(0,212,170,0.25)'}`,
              opacity: isEmpty ? 0.6 : 1,
            }}>
              <span style={{ fontSize:13, fontWeight:700, color: isEmpty ? 'var(--red)' : isLow ? 'var(--yellow)' : 'var(--text)' }}>
                {p.size || '—'}
              </span>
              <span style={{ fontSize:11, color: isEmpty ? 'var(--red)' : isLow ? 'var(--yellow)' : 'var(--green)', fontWeight:600 }}>
                {qty}
              </span>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize:11, color:'var(--text3)' }}>
        Всего остаток: <strong style={{ color:'var(--text)' }}>{totalStock} {sizes[0]?.unit || 'пар'}</strong>
        {' · '}
        {sizes.filter(p => (p.stock?.reduce((a,s)=>a+s.quantity,0)||0) === 0).length > 0 && (
          <span style={{ color:'var(--red)' }}>
            Нет в наличии: {sizes.filter(p => (p.stock?.reduce((a,s)=>a+s.quantity,0)||0) === 0).map(p=>p.size).join(', ')}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Модальное окно добавления/редактирования товара ───
function ProductModal({ product, categories, suppliers, onSave, onClose }) {
  const [form, setForm] = useState(
    product || {
      sku: '', barcode: '', name: '', brand: '', modelCode: '', size: '',
      gender: '', season: '', categoryId: '', supplierId: '',
      unit: 'пар', minStock: 0, costPrice: 0, salePrice: 0, description: ''
    }
  );
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showSizeGrid, setShowSizeGrid] = useState(false);
  const { show } = useToast();

  // При выборе модели — авто-заполнить brand/modelCode из существующих
  const f = (k, v) => { setForm(p => ({ ...p, [k]: v })); setErrors(e => ({ ...e, [k]: '' })); };

  const validate = () => {
    const e = {};
    if (!form.sku?.trim()) e.sku = 'Введите SKU или штрихкод товара';
    else if (form.sku.trim().length < 2) e.sku = 'SKU слишком короткий';
    if (!form.name?.trim()) e.name = 'Введите наименование товара';
    if (form.salePrice < 0) e.salePrice = 'Цена не может быть отрицательной';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const body = {
        ...form,
        categoryId: form.categoryId || null,
        supplierId: form.supplierId || null,
        barcode: form.barcode || null,
        brand: form.brand || null,
        modelCode: form.modelCode || null,
        size: form.size || null,
        gender: form.gender || null,
        season: form.season || null,
        minStock: +form.minStock,
        costPrice: +form.costPrice,
        salePrice: +form.salePrice,
      };
      // Map price → salePrice for backend compat
      if (product?.id) await api('/products/' + product.id, { method: 'PUT', body: JSON.stringify(body) });
      else await api('/products', { method: 'POST', body: JSON.stringify(body) });
      show('Товар сохранён', 'success');
      onSave();
    } catch (err) { show(err.message, 'error'); }
    finally { setLoading(false); }
  };

  const isEdit = !!product?.id;

  // Быстрое заполнение размеров обуви
  const fillShoeSize = (size) => {
    f('size', size);
    // Если нет SKU и есть modelCode — авто-SKU
    if (!form.sku && form.modelCode) {
      f('sku', `${form.modelCode}-${size}`);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth:580 }}>
        <div className="modal-header">
          <div className="modal-title">{isEdit ? 'Редактировать товар' : 'Новый товар'}</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ maxHeight:'75vh', overflowY:'auto' }}>

          {!isEdit && (
            <Hint type="info">
              Заполните SKU и наименование — они обязательны. Для обуви используйте Код модели + Размер для удобной размерной сетки.
            </Hint>
          )}

          {/* Основные поля */}
          <div style={{ marginTop:12, fontWeight:600, fontSize:12, color:'var(--text3)', textTransform:'uppercase', letterSpacing:0.5, marginBottom:8 }}>
            Основные данные
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">SKU / Штрихкод *</label>
              <input className="form-input" value={form.sku} onChange={e => f('sku', e.target.value)}
                placeholder="001234567890" style={errors.sku ? { borderColor:'var(--red)' } : {}} />
              <FieldError msg={errors.sku} />
              {!errors.sku && form.sku?.length > 0 && <Hint type="ok">SKU введён</Hint>}
            </div>
            <div className="form-group">
              <label className="form-label">Штрихкод (EAN/UPC)</label>
              <input className="form-input" value={form.barcode || ''} onChange={e => f('barcode', e.target.value)}
                placeholder="Необязательно" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Наименование *</label>
            <input className="form-input" value={form.name} onChange={e => f('name', e.target.value)}
              placeholder="Nike Air Max 270 — 42р" style={errors.name ? { borderColor:'var(--red)' } : {}} />
            <FieldError msg={errors.name} />
          </div>

          {/* Размерная сетка обуви */}
          <div style={{ border:'1px solid var(--border)', borderRadius:10, padding:'12px 14px', marginBottom:12, background:'var(--bg3)' }}>
            <div style={{ fontWeight:600, fontSize:12, color:'var(--accent)', textTransform:'uppercase', letterSpacing:0.5, marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
              <Grid size={13} /> Атрибуты обуви / Размерная сетка
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Бренд</label>
                <input className="form-input" value={form.brand || ''} onChange={e => f('brand', e.target.value)}
                  placeholder="Nike, Adidas, Puma..." />
              </div>
              <div className="form-group">
                <label className="form-label">Код модели</label>
                <input className="form-input" value={form.modelCode || ''} onChange={e => f('modelCode', e.target.value)}
                  placeholder="AM270, RS-X..." />
                <div style={{ fontSize:11, color:'var(--text3)', marginTop:3 }}>Все товары с одним кодом — одна модель в сетке</div>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Пол</label>
                <select className="form-select" value={form.gender || ''} onChange={e => f('gender', e.target.value)}>
                  <option value="">Не указан</option>
                  <option value="male">Мужской</option>
                  <option value="female">Женский</option>
                  <option value="unisex">Унисекс</option>
                  <option value="kids">Детский</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Сезон</label>
                <select className="form-select" value={form.season || ''} onChange={e => f('season', e.target.value)}>
                  <option value="">Не указан</option>
                  <option value="summer">Лето</option>
                  <option value="winter">Зима</option>
                  <option value="spring_fall">Весна/Осень</option>
                  <option value="all_season">Всесезонный</option>
                </select>
              </div>
            </div>

            {/* Размер — быстрый выбор */}
            <div className="form-group">
              <label className="form-label">Размер (EU)</label>
              <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:6 }}>
                {SHOE_SIZES_EU.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => fillShoeSize(s)}
                    style={{
                      padding:'4px 9px', borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer',
                      border: `1px solid ${form.size === s ? 'var(--accent)' : 'var(--border2)'}`,
                      background: form.size === s ? 'var(--accent-dim)' : 'var(--bg4)',
                      color: form.size === s ? 'var(--accent)' : 'var(--text2)',
                      transition: 'all 0.1s',
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <input className="form-input" value={form.size || ''} onChange={e => f('size', e.target.value)}
                placeholder="Или введите вручную: 42, 42.5, XXL..." />
            </div>
          </div>

          {/* Категория и поставщик */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Категория</label>
              <select className="form-select" value={form.categoryId || ''} onChange={e => f('categoryId', e.target.value)}>
                <option value="">Без категории</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Поставщик</label>
              <select className="form-select" value={form.supplierId || ''} onChange={e => f('supplierId', e.target.value)}>
                <option value="">Не указан</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Единица измерения</label>
              <select className="form-select" value={form.unit} onChange={e => f('unit', e.target.value)}>
                {['пар','шт','кг','г','л','мл','м','упак','коробка'].map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Мин. остаток</label>
              <input type="number" className="form-input" value={form.minStock} min={0}
                onChange={e => f('minStock', e.target.value)} />
              <div style={{ fontSize:11, color:'var(--text3)', marginTop:3 }}>Предупреждение при достижении</div>
            </div>
          </div>

          {/* Цены */}
          <div style={{ fontWeight:600, fontSize:12, color:'var(--text3)', textTransform:'uppercase', letterSpacing:0.5, marginBottom:8, marginTop:4 }}>
            Цены
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Себестоимость (сом)</label>
              <input type="number" className="form-input" value={form.costPrice} min={0}
                onChange={e => f('costPrice', e.target.value)} placeholder="0" />
              {form.costPrice > 0 && form.salePrice > 0 && (
                <Hint type="ok">Маржа: {Math.round((form.salePrice - form.costPrice) / form.salePrice * 100)}%</Hint>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">💰 Цена продажи (сом) *</label>
              <input type="number" className="form-input" value={form.salePrice} min={0}
                onChange={e => f('salePrice', e.target.value)} placeholder="0"
                style={{ fontSize:16, fontWeight:700, ...(errors.salePrice ? { borderColor:'var(--red)' } : {}) }} />
              <FieldError msg={errors.salePrice} />
              {form.salePrice === 0 && !errors.salePrice && <Hint type="warn">Цена не указана</Hint>}
              {form.salePrice > 0 && <Hint type="ok">Цена: {new Intl.NumberFormat('ru-RU').format(form.salePrice)} сом</Hint>}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Описание</label>
            <textarea className="form-textarea" value={form.description || ''} onChange={e => f('description', e.target.value)}
              placeholder="Модель, цвет, доп. характеристики..." />
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

// ─── Строка группы (модель) в таблице с разворачиваемой сеткой ───
function ModelRow({ modelCode, products, onEdit, onDelete, fmt }) {
  const [expanded, setExpanded] = useState(false);

  // Суммарный остаток по всем размерам
  const totalQty = products.reduce((s, p) => s + (p.stock?.reduce((a, st) => a + st.quantity, 0) || 0), 0);
  const anyLow = products.some(p => {
    const qty = p.stock?.reduce((a, st) => a + st.quantity, 0) || 0;
    return qty > 0 && qty <= p.minStock;
  });
  const anyEmpty = products.some(p => (p.stock?.reduce((a, st) => a + st.quantity, 0) || 0) === 0);

  const rep = products[0]; // representative product

  if (products.length === 1) {
    // Одиночный товар — обычная строка
    const p = products[0];
    const qty = p.stock?.reduce((a, st) => a + st.quantity, 0) || 0;
    return (
      <tr>
        <td><span className="mono" style={{ fontSize:11 }}>{p.sku}</span></td>
        <td>
          <div style={{ fontWeight:600 }}>{p.name}</div>
          {p.brand && <div style={{ fontSize:11, color:'var(--text3)' }}>{p.brand}</div>}
        </td>
        <td>{p.size ? <span style={{ background:'var(--bg4)', padding:'2px 7px', borderRadius:5, fontSize:12, fontWeight:600 }}>{p.size}</span> : <span style={{ color:'var(--text3)' }}>—</span>}</td>
        <td>{p.category?.name || <span style={{ color:'var(--text3)' }}>—</span>}</td>
        <td>{p.unit}</td>
        <td>
          <span style={{ fontWeight:700, color: p.salePrice > 0 ? 'var(--accent)' : 'var(--red)' }}>
            {p.salePrice > 0 ? fmt(p.salePrice) + ' с' : '⚠ нет'}
          </span>
        </td>
        <td>
          <span style={{ color: qty === 0 ? 'var(--red)' : qty <= p.minStock ? 'var(--yellow)' : 'var(--green)', fontWeight:600 }}>
            {qty}
          </span>
        </td>
        <td style={{ textAlign:'right' }}>
          <div style={{ display:'flex', gap:4, justifyContent:'flex-end' }}>
            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => onEdit(p)}><Edit2 size={14} /></button>
            <button className="btn btn-danger btn-sm btn-icon" onClick={() => onDelete(p.id, p.name)}><Trash2 size={14} /></button>
          </div>
        </td>
      </tr>
    );
  }

  // Группа по modelCode — сворачиваемая строка
  return (
    <>
      <tr
        style={{ cursor:'pointer', background: expanded ? 'rgba(0,212,170,0.04)' : undefined }}
        onClick={() => setExpanded(!expanded)}
      >
        <td colSpan={2}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            {expanded ? <ChevronUp size={14} style={{ color:'var(--accent)' }} /> : <ChevronDown size={14} style={{ color:'var(--text3)' }} />}
            <div>
              <span style={{ fontWeight:700 }}>{rep.brand ? `${rep.brand} ` : ''}{modelCode}</span>
              <span style={{ fontSize:11, color:'var(--text3)', marginLeft:6 }}>{products.length} размеров</span>
            </div>
          </div>
        </td>
        <td>
          {/* Мини-сетка размеров */}
          <div style={{ display:'flex', gap:3, flexWrap:'wrap' }}>
            {products.map(p => {
              const qty = p.stock?.reduce((a, st) => a + st.quantity, 0) || 0;
              return (
                <span key={p.id} style={{
                  padding:'1px 5px', borderRadius:4, fontSize:11, fontWeight:600,
                  background: qty === 0 ? 'rgba(255,77,109,0.12)' : qty <= p.minStock ? 'rgba(255,179,0,0.12)' : 'rgba(0,212,170,0.1)',
                  color: qty === 0 ? 'var(--red)' : qty <= p.minStock ? 'var(--yellow)' : 'var(--text2)',
                }}>
                  {p.size || '?'}
                </span>
              );
            })}
          </div>
        </td>
        <td>{rep.category?.name || <span style={{ color:'var(--text3)' }}>—</span>}</td>
        <td>{rep.unit}</td>
        <td>
          <span style={{ fontWeight:700, color:'var(--accent)' }}>
            {fmt(rep.salePrice)} с
          </span>
        </td>
        <td>
          <span style={{ fontWeight:600, color: totalQty === 0 ? 'var(--red)' : anyLow ? 'var(--yellow)' : 'var(--green)' }}>
            {totalQty}
          </span>
        </td>
        <td></td>
      </tr>
      {expanded && products.map(p => {
        const qty = p.stock?.reduce((a, st) => a + st.quantity, 0) || 0;
        return (
          <tr key={p.id} style={{ background:'rgba(0,212,170,0.025)', borderLeft:'2px solid var(--accent)' }}>
            <td style={{ paddingLeft:28 }}>
              <span className="mono" style={{ fontSize:11, color:'var(--text3)' }}>{p.sku}</span>
            </td>
            <td style={{ color:'var(--text2)', fontSize:13 }}>{p.name}</td>
            <td>
              <span style={{
                background: qty === 0 ? 'rgba(255,77,109,0.15)' : 'var(--accent-dim)',
                color: qty === 0 ? 'var(--red)' : 'var(--accent)',
                padding:'2px 8px', borderRadius:5, fontSize:12, fontWeight:700
              }}>
                {p.size || '—'}
              </span>
            </td>
            <td></td>
            <td style={{ fontSize:12, color:'var(--text3)' }}>{p.unit}</td>
            <td style={{ fontSize:13 }}>{fmt(p.salePrice)} с</td>
            <td>
              <span style={{ fontWeight:600, color: qty === 0 ? 'var(--red)' : qty <= p.minStock ? 'var(--yellow)' : 'var(--green)' }}>
                {qty}
              </span>
            </td>
            <td style={{ textAlign:'right' }}>
              <div style={{ display:'flex', gap:4, justifyContent:'flex-end' }}>
                <button className="btn btn-ghost btn-sm btn-icon" onClick={e => { e.stopPropagation(); onEdit(p); }}><Edit2 size={14} /></button>
                <button className="btn btn-danger btn-sm btn-icon" onClick={e => { e.stopPropagation(); onDelete(p.id, p.name); }}><Trash2 size={14} /></button>
              </div>
            </td>
          </tr>
        );
      })}
    </>
  );
}

// ─── Главная страница ───
export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState('');
  const [filterSize, setFilterSize] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [groupByModel, setGroupByModel] = useState(true);
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(true);
  const { show } = useToast();
  const barcodeRef = useRef('');
  const barcodeTimer = useRef(null);

  useEffect(() => {
    document.getElementById('page-title').textContent = 'Товары';
    load();
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
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
    const [p, c, s] = await Promise.all([api('/products'), api('/categories'), api('/suppliers').catch(()=>[])]);
    setProducts(p);
    setCategories(c);
    setSuppliers(s);
    setLoading(false);
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Удалить товар "${name}"?`)) return;
    try {
      await api('/products/' + id, { method: 'DELETE' });
      show('Товар удалён', 'success');
      load();
    } catch (err) { show(err.message, 'error'); }
  };

  const fmt = n => new Intl.NumberFormat('ru-RU').format(n);

  // Фильтрация
  const filtered = products.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !search || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) ||
      (p.brand && p.brand.toLowerCase().includes(q)) || (p.modelCode && p.modelCode.toLowerCase().includes(q));
    const matchSize = !filterSize || p.size === filterSize;
    const matchBrand = !filterBrand || p.brand === filterBrand;
    return matchSearch && matchSize && matchBrand;
  });

  // Группировка по modelCode
  const grouped = {};
  filtered.forEach(p => {
    const key = (groupByModel && p.modelCode) ? p.modelCode : `_single_${p.id}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(p);
  });

  // Уникальные бренды и размеры для фильтров
  const brands = [...new Set(products.map(p => p.brand).filter(Boolean))];
  const sizes = [...new Set(products.map(p => p.size).filter(Boolean))].sort((a, b) => +a - +b);

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16, flexWrap:'wrap' }}>
        <div className="search-bar" style={{ flex:1, minWidth:200 }}>
          <Search size={15} className="search-icon" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по названию, SKU, бренду..." />
        </div>

        {/* Фильтр по размеру */}
        <select className="form-select" style={{ width:110 }} value={filterSize} onChange={e => setFilterSize(e.target.value)}>
          <option value="">Все размеры</option>
          {sizes.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        {/* Фильтр по бренду */}
        {brands.length > 0 && (
          <select className="form-select" style={{ width:130 }} value={filterBrand} onChange={e => setFilterBrand(e.target.value)}>
            <option value="">Все бренды</option>
            {brands.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        )}

        {/* Группировка */}
        <button
          className={`btn btn-sm ${groupByModel ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setGroupByModel(!groupByModel)}
          title="Группировать по модели"
        >
          <Grid size={13} /> Сетка
        </button>

        <div style={{ fontSize:12, color:'var(--text3)', display:'flex', alignItems:'center', gap:5, marginLeft:4 }}>
          <Scan size={13} /> Сканер активен
        </div>

        <button className="btn btn-primary" onClick={() => setModal({})}>
          <Plus size={15} /> Добавить
        </button>
      </div>

      {/* Stats bar */}
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
        <div style={{ fontSize:12, color:'var(--text3)' }}>
          Всего: <strong style={{ color:'var(--text)' }}>{filtered.length}</strong> позиций
          {groupByModel && Object.keys(grouped).filter(k => !k.startsWith('_single_')).length > 0 && (
            <> · <strong style={{ color:'var(--accent)' }}>{Object.keys(grouped).filter(k => !k.startsWith('_single_')).length}</strong> моделей</>
          )}
          {filtered.some(p => (p.stock?.reduce((a,s)=>a+s.quantity,0)||0) === 0) && (
            <> · <span style={{ color:'var(--red)' }}>{filtered.filter(p => (p.stock?.reduce((a,s)=>a+s.quantity,0)||0) === 0).length} нет в наличии</span></>
          )}
        </div>
      </div>

      {loading ? <div className="loader"><div className="spinner" /></div> : (
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          {Object.keys(grouped).length === 0 ? (
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
                  <th>Размер</th>
                  <th>Категория</th>
                  <th>Ед.</th>
                  <th>Цена</th>
                  <th>Остаток</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(grouped).map(([key, prods]) => (
                  <ModelRow
                    key={key}
                    modelCode={key.startsWith('_single_') ? null : key}
                    products={prods}
                    onEdit={p => setModal(p)}
                    onDelete={handleDelete}
                    fmt={fmt}
                  />
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
          suppliers={suppliers}
          onSave={() => { setModal(null); load(); }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
