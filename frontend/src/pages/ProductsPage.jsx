import React, { useEffect, useState, useRef } from 'react';
import {
  Plus, Search, Edit2, Trash2, Scan, AlertCircle, CheckCircle,
  Info, Grid, ChevronDown, ChevronUp, Package, ArrowDownCircle,
  X, Copy, Layers
} from 'lucide-react';
import { api } from '../utils/api';
import { useToast } from '../hooks/useToast.jsx';

const SHOE_SIZES_EU = ['34','35','36','37','38','39','40','41','42','43','44','45','46','47','48'];

// ─── Вспомогательные компоненты ───────────────────────────────────────────────
function Hint({ type = 'info', children }) {
  const map = {
    info: { bg:'rgba(0,180,216,0.08)', border:'var(--accent)', color:'var(--accent)', icon:<Info size={12}/> },
    warn: { bg:'rgba(255,180,0,0.10)', border:'#f59e0b', color:'#f59e0b', icon:<AlertCircle size={12}/> },
    ok:   { bg:'rgba(0,200,100,0.08)', border:'var(--green)', color:'var(--green)', icon:<CheckCircle size={12}/> },
  };
  const s = map[type];
  return (
    <div style={{ display:'flex',alignItems:'flex-start',gap:5,marginTop:4,padding:'5px 9px',
      borderRadius:6,background:s.bg,border:'1px solid '+s.border,color:s.color,fontSize:12,lineHeight:1.4 }}>
      {s.icon}<span>{children}</span>
    </div>
  );
}
function FieldError({ msg }) {
  if (!msg) return null;
  return <div style={{ color:'var(--red)',fontSize:11,marginTop:2,display:'flex',alignItems:'center',gap:3 }}>
    <AlertCircle size={10}/>{msg}
  </div>;
}

// ─── Размерная сетка ──────────────────────────────────────────────────────────
// Одна строка = один размер + его количество (qty). Размер можно добавить несколько раз.
// Например: 36×2, 36×1 — это два лота размера 36 (разные партии).
// Но обычно: 36×3, 37×2, 38×5 — просто штуки по размерам.

function SizeGridEditor({ sizes, onChange, unit, modelCode, brand, baseName, baseSkuFn }) {
  // sizes: [{ size, qty, sku, barcode }]

  const addSize = (sz) => {
    const newSku = baseSkuFn ? baseSkuFn(sz, sizes.filter(r=>r.size===sz).length) : '';
    onChange([...sizes, { size: sz, qty: 1, sku: newSku, barcode: '' }]);
  };

  const removeRow = (idx) => onChange(sizes.filter((_,i)=>i!==idx));

  const updateRow = (idx, key, val) => {
    onChange(sizes.map((r,i)=>i===idx ? {...r,[key]:val} : r));
  };

  // Авто-SKU на основе modelCode + размер + порядок
  const autoSku = (sz, order) => {
    const base = (modelCode || brand || 'SKU').toUpperCase().replace(/\s+/g,'');
    const suffix = order > 0 ? `-${order+1}` : '';
    return `${base}-${sz}${suffix}`;
  };

  const fillAll = () => {
    const filled = SHOE_SIZES_EU.map((sz, i) => ({
      size: sz,
      qty: 1,
      sku: autoSku(sz, 0),
      barcode: ''
    }));
    onChange(filled);
  };

  const clearAll = () => onChange([]);

  // Подсветка размеров которые уже есть
  const addedSizes = new Set(sizes.map(r=>r.size));
  const sizeCount = {};
  sizes.forEach(r => { sizeCount[r.size] = (sizeCount[r.size]||0)+1; });

  return (
    <div>
      {/* Быстрые кнопки размеров */}
      <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:10 }}>
        {SHOE_SIZES_EU.map(sz => {
          const cnt = sizeCount[sz] || 0;
          return (
            <button
              key={sz}
              type="button"
              onClick={() => addSize(sz)}
              style={{
                position:'relative',
                padding:'5px 10px', borderRadius:7, fontSize:12, fontWeight:700, cursor:'pointer',
                border: `1.5px solid ${cnt > 0 ? 'var(--accent)' : 'var(--border2)'}`,
                background: cnt > 0 ? 'var(--accent-dim,rgba(0,212,170,0.12))' : 'var(--bg4)',
                color: cnt > 0 ? 'var(--accent)' : 'var(--text2)',
                transition:'all 0.12s',
                minWidth: 38, textAlign:'center'
              }}
            >
              {sz}
              {cnt > 0 && (
                <span style={{
                  position:'absolute', top:-6, right:-6,
                  background:'var(--accent)', color:'#000',
                  fontSize:9, fontWeight:800, borderRadius:'50%',
                  width:14, height:14, display:'flex', alignItems:'center', justifyContent:'center',
                  lineHeight:1
                }}>{cnt}</span>
              )}
            </button>
          );
        })}
      </div>

      <div style={{ display:'flex', gap:6, marginBottom:10 }}>
        <input
          placeholder="Свой размер..."
          style={{
            flex:1, padding:'5px 9px', borderRadius:6, fontSize:12,
            background:'var(--bg4)', border:'1px solid var(--border2)',
            color:'var(--text)', outline:'none'
          }}
          onKeyDown={e => {
            if (e.key==='Enter' && e.target.value.trim()) {
              addSize(e.target.value.trim());
              e.target.value='';
            }
          }}
        />
        <button type="button" className="btn btn-secondary btn-sm" onClick={fillAll}>
          Заполнить все
        </button>
        {sizes.length > 0 && (
          <button type="button" className="btn btn-danger btn-sm" onClick={clearAll}>
            <X size={12}/> Очистить
          </button>
        )}
      </div>

      {/* Таблица выбранных размеров */}
      {sizes.length > 0 && (
        <div style={{ border:'1px solid var(--border)', borderRadius:8, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:'var(--bg3)', borderBottom:'1px solid var(--border)' }}>
                <th style={{ padding:'7px 10px', textAlign:'left', fontWeight:600, fontSize:11, color:'var(--text3)', width:70 }}>Размер</th>
                <th style={{ padding:'7px 10px', textAlign:'left', fontWeight:600, fontSize:11, color:'var(--text3)', width:70 }}>Кол-во</th>

                <th style={{ width:32 }}></th>
              </tr>
            </thead>
            <tbody>
              {sizes.map((row, idx) => (
                <tr key={idx} style={{ borderBottom:'1px solid var(--border)', background: idx%2===0?'var(--bg2)':'var(--bg3)' }}>
                  <td style={{ padding:'5px 8px' }}>
                    <span style={{
                      display:'inline-block', padding:'3px 10px', borderRadius:6,
                      background:'var(--accent-dim,rgba(0,212,170,0.12))', color:'var(--accent)',
                      fontWeight:700, fontSize:13
                    }}>{row.size}</span>
                  </td>
                  <td style={{ padding:'5px 8px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                      <button type="button"
                        onClick={() => updateRow(idx,'qty',Math.max(1,+row.qty-1))}
                        style={{ width:22,height:22,borderRadius:4,border:'1px solid var(--border2)',
                          background:'var(--bg4)',cursor:'pointer',color:'var(--text)',fontSize:14,
                          display:'flex',alignItems:'center',justifyContent:'center' }}>−</button>
                      <input
                        type="number" min={1}
                        value={row.qty}
                        onChange={e=>updateRow(idx,'qty',Math.max(1,+e.target.value||1))}
                        style={{ width:40,textAlign:'center',padding:'2px 4px',borderRadius:5,
                          border:'1px solid var(--border2)',background:'var(--bg)',
                          color:'var(--text)',fontSize:13,fontWeight:700 }}
                      />
                      <button type="button"
                        onClick={() => updateRow(idx,'qty',+row.qty+1)}
                        style={{ width:22,height:22,borderRadius:4,border:'1px solid var(--border2)',
                          background:'var(--bg4)',cursor:'pointer',color:'var(--text)',fontSize:14,
                          display:'flex',alignItems:'center',justifyContent:'center' }}>+</button>
                    </div>
                  </td>


                  <td style={{ padding:'5px 6px', textAlign:'center' }}>
                    <button type="button" onClick={()=>removeRow(idx)}
                      style={{ width:22,height:22,borderRadius:4,border:'none',
                        background:'rgba(255,77,109,0.12)',cursor:'pointer',
                        color:'var(--red)',display:'flex',alignItems:'center',justifyContent:'center' }}>
                      <X size={12}/>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding:'6px 12px', background:'var(--bg3)', borderTop:'1px solid var(--border)',
            fontSize:12, color:'var(--text3)', display:'flex', gap:16 }}>
            <span>Размеров: <strong style={{color:'var(--text)'}}>{sizes.length}</strong></span>
            <span>Итого единиц: <strong style={{color:'var(--accent)'}}>{sizes.reduce((s,r)=>s+(+r.qty||0),0)} {unit}</strong></span>
            <span>Уникальных размеров: <strong style={{color:'var(--text)'}}>{new Set(sizes.map(r=>r.size)).size}</strong></span>
          </div>
        </div>
      )}

      {sizes.length === 0 && (
        <div style={{ textAlign:'center', padding:'16px', color:'var(--text3)', fontSize:12,
          border:'1px dashed var(--border2)', borderRadius:8 }}>
          Нажмите на размер выше чтобы добавить его в линейку
        </div>
      )}
    </div>
  );
}

// ─── Режимы создания товара ───────────────────────────────────────────────────
// mode = 'single' | 'grid' (размерная сетка)

function ProductModal({ product, categories, suppliers, warehouses, onSave, onClose }) {
  const isEdit = !!product?.id;

  // Режим — одиночный или сетка
  const [mode, setMode] = useState(isEdit ? 'single' : 'grid');

  // Общая форма (применяется ко всем размерам в сетке)
  const [form, setForm] = useState(product || {
    sku:'', barcode:'', name:'', brand:'', modelCode:'', size:'',
    gender:'', season:'', categoryId:'', supplierId:'',
    unit:'пар', minStock:0, costPrice:0, salePrice:0, description:''
  });

  // Размерная сетка
  const [sizeRows, setSizeRows] = useState([]);

  // Приход
  const [doReceipt, setDoReceipt] = useState(false);
  const [receiptForm, setReceiptForm] = useState({ warehouseId:'', supplierId:'', costPerUnit:0, notes:'' });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const { show } = useToast();

  const f = (k,v) => { setForm(p=>({...p,[k]:v})); setErrors(e=>({...e,[k]:''})); };
  const rf = (k,v) => setReceiptForm(p=>({...p,[k]:v}));

  // Авто-SKU для сетки
  const autoSku = (sz, order) => {
    const base = (form.modelCode||form.brand||'SKU').toUpperCase().replace(/\s+/g,'');
    return `${base}-${sz}${order>0?`-${order+1}`:''}`;
  };

  // При смене modelCode — обновить SKU в сетке
  useEffect(() => {
    if (mode==='grid' && sizeRows.length>0) {
      const counts = {};
      setSizeRows(rows => rows.map(r => {
        const order = counts[r.size]||0;
        counts[r.size] = order+1;
        const generated = autoSku(r.size, order);
        // Обновляем только если SKU ещё не трогали вручную
        return r.sku===autoSku(r.size,order,form.modelCode) || !r.sku ? {...r, sku: generated} : r;
      }));
    }
  }, [form.modelCode, form.brand]);

  const validate = () => {
    const e = {};
    if (!form.name?.trim()) e.name = 'Введите наименование';
    if (mode==='single') {
      if (!form.sku?.trim()) e.sku = 'Введите SKU';
    } else {
      if (sizeRows.length===0) e.sizes = 'Добавьте хотя бы один размер';

    }
    if (doReceipt && !receiptForm.warehouseId) e.warehouseId='Выберите склад';
    setErrors(e);
    return Object.keys(e).length===0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const base = {
        name:form.name, brand:form.brand||null, modelCode:form.modelCode||null,
        gender:form.gender||null, season:form.season||null,
        categoryId:form.categoryId||null, supplierId:form.supplierId||null,
        unit:form.unit, minStock:+form.minStock,
        costPrice:+form.costPrice, salePrice:+form.salePrice,
        description:form.description||null,
      };

      if (isEdit) {
        await api('/products/'+product.id, { method:'PUT', body:JSON.stringify({
          ...base, sku:form.sku, barcode:form.barcode||null,
          size:form.size||null, isActive:true
        })});
        show('Товар сохранён','success');
        onSave(); return;
      }

      if (mode==='single') {
        const saved = await api('/products', { method:'POST', body:JSON.stringify({
          ...base, sku:form.sku.trim(), barcode:form.barcode||null, size:form.size||null
        })});
        if (doReceipt && saved?.id) {
          await doReceiptFor([{ productId:saved.id, qty:1 }]);
        }
        show('Товар добавлен','success');

      } else {
        // Размерная сетка — ОДИН товар с массивом sizes
        const saved = await api('/products', { method:'POST', body:JSON.stringify({
          ...base,
          sku: form.modelCode
            ? `${form.modelCode.toUpperCase().replace(/\s+/g,'')}-MULTI`
            : `${form.name.toUpperCase().replace(/\s+/g,'').slice(0,8)}-MULTI`,
          sizes: sizeRows.map(row => ({
            size: row.size,
            qty: parseFloat(row.qty) || 1,
          }))
        })});

        if (doReceipt && receiptForm.warehouseId && saved?.id) {
          // Приход по каждому размеру
          const receiptItems = saved.sizes.map(sz => {
            const row = sizeRows.find(r => r.size === sz.size);
            return { productId: saved.id, sizeId: sz.id, qty: row ? +row.qty : 1 };
          });
          await doReceiptFor(receiptItems);
        }
        show(`Товар "${form.name}" добавлен с ${sizeRows.length} размерами${doReceipt?' + приход':''}`, 'success');
      }

      onSave();
    } catch(err){ show(err.message,'error'); }
    finally { setLoading(false); }
  };

  const doReceiptFor = async (items) => {
    await api('/receipts', {
      method:'POST',
      body:JSON.stringify({
        warehouseId:+receiptForm.warehouseId,
        supplierId:receiptForm.supplierId?+receiptForm.supplierId:null,
        notes:receiptForm.notes||`Приход: ${form.name}`,
        autoConfirm:true,
        items: items.map(i=>({
          productId:i.productId,
          sizeId: i.sizeId || null,
          quantity:i.qty,
          costPerUnit:+receiptForm.costPerUnit||+form.costPrice||0
        }))
      })
    });
  };

  const totalGridQty = sizeRows.reduce((s,r)=>s+(+r.qty||0),0);

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth:680, width:'95vw' }}>
        <div className="modal-header">
          <div className="modal-title">
            {isEdit ? 'Редактировать товар' : 'Добавить товар'}
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={15}/></button>
        </div>

        {/* Переключатель режима (только для нового) */}
        {!isEdit && (
          <div style={{ display:'flex', borderBottom:'1px solid var(--border)', padding:'0 20px', gap:0 }}>
            {[
              { id:'grid', label:'Размерная сетка', icon:<Layers size={13}/> },
              { id:'single', label:'Одиночный товар', icon:<Package size={13}/> },
            ].map(tab=>(
              <button key={tab.id} onClick={()=>setMode(tab.id)}
                style={{
                  padding:'10px 18px', border:'none', background:'none', cursor:'pointer', gap:5,
                  display:'flex', alignItems:'center',
                  borderBottom: mode===tab.id ? '2px solid var(--accent)' : '2px solid transparent',
                  color: mode===tab.id ? 'var(--accent)' : 'var(--text3)',
                  fontWeight: mode===tab.id ? 700 : 400, fontSize:13
                }}>
                {tab.icon} {tab.label}
              </button>
            ))}
            <button onClick={()=>setDoReceipt(v=>!v)}
              style={{
                marginLeft:'auto', padding:'8px 14px', border:'none', cursor:'pointer', gap:5,
                display:'flex', alignItems:'center',
                background: doReceipt ? 'rgba(0,212,170,0.12)' : 'transparent',
                borderRadius:8, color: doReceipt ? 'var(--accent)' : 'var(--text3)',
                fontWeight: doReceipt ? 700 : 400, fontSize:12
              }}>
              <ArrowDownCircle size={13}/> {doReceipt ? '✓ Приход вкл.' : '+ Добавить приход'}
            </button>
          </div>
        )}

        <div className="modal-body" style={{ maxHeight:'75vh', overflowY:'auto' }}>

          {/* ─── Общие поля модели ─────────────────────────────── */}
          <div style={{ fontWeight:700, fontSize:11, color:'var(--text3)', textTransform:'uppercase',
            letterSpacing:0.8, marginBottom:10, marginTop:4 }}>
            {mode==='grid' ? 'Общие данные модели' : 'Данные товара'}
          </div>

          {mode==='grid' && (
            <Hint type="info">
              Заполните общие данные (бренд, модель, цена) — они применятся ко всем размерам.
              Ниже добавьте размеры и укажите количество для каждого.
            </Hint>
          )}

          <div style={{ marginTop:10 }}>
            <div className="form-group">
              <label className="form-label">Наименование модели *</label>
              <input className="form-input" value={form.name} onChange={e=>f('name',e.target.value)}
                placeholder="Adidas Ultraboost 22" style={errors.name?{borderColor:'var(--red)'}:{}}/>
              <FieldError msg={errors.name}/>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Бренд</label>
                <input className="form-input" value={form.brand||''} onChange={e=>f('brand',e.target.value)}
                  placeholder="Adidas, Nike, Puma..."/>
              </div>
              <div className="form-group">
                <label className="form-label">Код модели</label>
                <input className="form-input" value={form.modelCode||''} onChange={e=>f('modelCode',e.target.value)}
                  placeholder="UB22, AM270..."/>
                {mode==='grid' && <div style={{fontSize:10,color:'var(--text3)',marginTop:2}}>
                  Используется для авто-SKU: UB22-36, UB22-37...
                </div>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Пол</label>
                <select className="form-select" value={form.gender||''} onChange={e=>f('gender',e.target.value)}>
                  <option value="">Не указан</option>
                  <option value="male">Мужской</option>
                  <option value="female">Женский</option>
                  <option value="unisex">Унисекс</option>
                  <option value="kids">Детский</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Сезон</label>
                <select className="form-select" value={form.season||''} onChange={e=>f('season',e.target.value)}>
                  <option value="">Не указан</option>
                  <option value="summer">Лето</option>
                  <option value="winter">Зима</option>
                  <option value="spring_fall">Весна/Осень</option>
                  <option value="all_season">Всесезонный</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Категория</label>
                <select className="form-select" value={form.categoryId||''} onChange={e=>f('categoryId',e.target.value)}>
                  <option value="">Без категории</option>
                  {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Поставщик</label>
                <select className="form-select" value={form.supplierId||''} onChange={e=>f('supplierId',e.target.value)}>
                  <option value="">Не указан</option>
                  {suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Ед. измерения</label>
                <select className="form-select" value={form.unit} onChange={e=>f('unit',e.target.value)}>
                  {['пар','шт','кг','г','л','мл','м','упак','коробка'].map(u=><option key={u}>{u}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Мин. остаток</label>
                <input type="number" className="form-input" value={form.minStock} min={0}
                  onChange={e=>f('minStock',e.target.value)}/>
              </div>
            </div>

            {/* Цены */}
            <div style={{ fontWeight:700, fontSize:11, color:'var(--text3)', textTransform:'uppercase',
              letterSpacing:0.8, marginBottom:8, marginTop:4 }}>Цены</div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Себестоимость (сом)</label>
                <input type="number" className="form-input" value={form.costPrice} min={0}
                  onChange={e=>f('costPrice',e.target.value)} placeholder="0"/>
                {form.costPrice>0&&form.salePrice>0&&(
                  <Hint type="ok">Маржа: {Math.round((form.salePrice-form.costPrice)/form.salePrice*100)}%</Hint>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">💰 Цена продажи (сом) *</label>
                <input type="number" className="form-input" value={form.salePrice} min={0}
                  onChange={e=>f('salePrice',e.target.value)} placeholder="0"
                  style={{ fontSize:16, fontWeight:700 }}/>
                {+form.salePrice===0 && <Hint type="warn">Товар не продастся без цены на кассе</Hint>}
                {+form.salePrice>0 && <Hint type="ok">Цена: {Number(form.salePrice).toLocaleString('ru-RU')} сом</Hint>}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Описание</label>
              <textarea className="form-textarea" value={form.description||''} rows={2}
                onChange={e=>f('description',e.target.value)} placeholder="Цвет, характеристики..."/>
            </div>
          </div>

          {/* ─── Одиночный: SKU + размер ───────────────────────── */}
          {(isEdit || mode==='single') && (
            <div style={{ marginTop:4 }}>
              <div style={{ fontWeight:700, fontSize:11, color:'var(--text3)', textTransform:'uppercase',
                letterSpacing:0.8, marginBottom:8 }}>Идентификатор</div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">SKU *</label>
                  <input className="form-input" value={form.sku} onChange={e=>f('sku',e.target.value)}
                    placeholder="001234567890" style={errors.sku?{borderColor:'var(--red)'}:{}}/>
                  <FieldError msg={errors.sku}/>
                </div>
                <div className="form-group">
                  <label className="form-label">Штрихкод (EAN/UPC)</label>
                  <input className="form-input" value={form.barcode||''} onChange={e=>f('barcode',e.target.value)}
                    placeholder="Необязательно"/>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Размер</label>
                <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:6 }}>
                  {SHOE_SIZES_EU.map(sz=>(
                    <button key={sz} type="button" onClick={()=>f('size',sz)}
                      style={{
                        padding:'4px 8px', borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer',
                        border:`1.5px solid ${form.size===sz?'var(--accent)':'var(--border2)'}`,
                        background:form.size===sz?'var(--accent-dim,rgba(0,212,170,0.12))':'var(--bg4)',
                        color:form.size===sz?'var(--accent)':'var(--text2)',
                      }}>{sz}</button>
                  ))}
                </div>
                <input className="form-input" value={form.size||''} onChange={e=>f('size',e.target.value)}
                  placeholder="Или вручную: 42, 42.5, XL..."/>
              </div>
            </div>
          )}

          {/* ─── Размерная сетка ────────────────────────────────── */}
          {!isEdit && mode==='grid' && (
            <div style={{ marginTop:16 }}>
              <div style={{ fontWeight:700, fontSize:11, color:'var(--text3)', textTransform:'uppercase',
                letterSpacing:0.8, marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
                <Layers size={13}/> Размерная линейка
                {sizeRows.length>0 && (
                  <span style={{ background:'var(--accent)', color:'#000', fontSize:10, fontWeight:800,
                    padding:'1px 6px', borderRadius:99, marginLeft:4 }}>
                    {sizeRows.length} пар(ок)
                  </span>
                )}
              </div>
              <FieldError msg={errors.sizes}/>
              <SizeGridEditor
                sizes={sizeRows}
                onChange={setSizeRows}
                unit={form.unit}
                modelCode={form.modelCode}
                brand={form.brand}
                baseSkuFn={(sz, order) => autoSku(sz, order)}
              />
            </div>
          )}

          {/* ─── Приход ─────────────────────────────────────────── */}
          {doReceipt && (
            <div style={{ marginTop:16, border:'1px solid var(--accent)', borderRadius:10,
              padding:'14px 16px', background:'rgba(0,212,170,0.03)' }}>
              <div style={{ fontWeight:700, fontSize:13, color:'var(--accent)', marginBottom:12,
                display:'flex', alignItems:'center', gap:6 }}>
                <ArrowDownCircle size={15}/>
                Поставить на приход
                {mode==='grid' && totalGridQty>0 && (
                  <span style={{ fontSize:12, color:'var(--text3)', fontWeight:400, marginLeft:4 }}>
                    — {totalGridQty} {form.unit} ({sizeRows.length} позиций)
                  </span>
                )}
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Склад *</label>
                  <select className="form-select" value={receiptForm.warehouseId}
                    onChange={e=>rf('warehouseId',e.target.value)}
                    style={errors.warehouseId?{borderColor:'var(--red)'}:{}}>
                    <option value="">Выберите склад</option>
                    {warehouses.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                  <FieldError msg={errors.warehouseId}/>
                </div>
                <div className="form-group">
                  <label className="form-label">Поставщик</label>
                  <select className="form-select" value={receiptForm.supplierId}
                    onChange={e=>rf('supplierId',e.target.value)}>
                    <option value="">Без поставщика</option>
                    {suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Закупочная цена за ед. (сом)</label>
                  <input type="number" className="form-input" value={receiptForm.costPerUnit} min={0}
                    onChange={e=>rf('costPerUnit',e.target.value)}
                    placeholder={form.costPrice||'0'}/>
                  {totalGridQty>0 && receiptForm.costPerUnit>0 && (
                    <Hint type="info">
                      Итого закупка: {(totalGridQty*(+receiptForm.costPerUnit||0)).toLocaleString('ru-RU')} сом
                    </Hint>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Примечание</label>
                  <input className="form-input" value={receiptForm.notes}
                    onChange={e=>rf('notes',e.target.value)} placeholder="Накладная №, дата..."/>
                </div>
              </div>
              <Hint type="ok">
                Все позиции будут сразу подтверждены и зачислены на остаток склада.
              </Hint>
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ gap:8 }}>
          <button className="btn btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn btn-primary" onClick={handleSave}
            disabled={loading||!form.name||(mode==='single'&&!isEdit&&!form.sku)||(mode==='grid'&&sizeRows.length===0&&!isEdit)}>
            {loading ? 'Сохранение...' : (
              mode==='grid' && !isEdit
                ? `💾 Создать ${sizeRows.length} поз.${doReceipt?' + приход':''}`
                : `💾 Сохранить${doReceipt?' + приход':''}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Строки таблицы ───────────────────────────────────────────────────────────
function ModelRow({ modelCode, products, onEdit, onDelete, fmt }) {
  const [expanded, setExpanded] = useState(false);
  const totalQty = products.reduce((s,p)=>s+(p.stock?.reduce((a,st)=>a+st.quantity,0)||0),0);
  const anyLow = products.some(p=>{ const q=p.stock?.reduce((a,st)=>a+st.quantity,0)||0; return q>0&&q<=p.minStock; });
  const rep = products[0];

  if (products.length===1) {
    const p = products[0];
    const qty = p.stock?.reduce((a,st)=>a+st.quantity,0)||0;
    return (
      <tr>
        <td><span className="mono" style={{fontSize:11}}>{p.sku}</span></td>
        <td>
          <div style={{fontWeight:600}}>{p.name}</div>
          {p.brand&&<div style={{fontSize:11,color:'var(--text3)'}}>{p.brand}</div>}
        </td>
        <td>{p.size?<span style={{background:'var(--bg4)',padding:'2px 7px',borderRadius:5,fontSize:12,fontWeight:600}}>{p.size}</span>:<span style={{color:'var(--text3)'}}>—</span>}</td>
        <td>{p.category?.name||<span style={{color:'var(--text3)'}}>—</span>}</td>
        <td>{p.unit}</td>
        <td><span style={{fontWeight:700,color:p.salePrice>0?'var(--accent)':'var(--red)'}}>
          {p.salePrice>0?fmt(p.salePrice)+' с':'⚠ нет цены'}
        </span></td>
        <td><span style={{color:qty===0?'var(--red)':qty<=p.minStock?'var(--yellow)':'var(--green)',fontWeight:600}}>{qty}</span></td>
        <td style={{textAlign:'right'}}>
          <div style={{display:'flex',gap:4,justifyContent:'flex-end'}}>
            <button className="btn btn-ghost btn-sm btn-icon" onClick={()=>onEdit(p)}><Edit2 size={14}/></button>
            <button className="btn btn-danger btn-sm btn-icon" onClick={()=>onDelete(p.id,p.name)}><Trash2 size={14}/></button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <>
      <tr style={{cursor:'pointer',background:expanded?'rgba(0,212,170,0.04)':undefined}}
        onClick={()=>setExpanded(!expanded)}>
        <td colSpan={2}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            {expanded?<ChevronUp size={14} style={{color:'var(--accent)'}}/>:<ChevronDown size={14} style={{color:'var(--text3)'}}/>}
            <div>
              <span style={{fontWeight:700}}>{rep.brand?`${rep.brand} `:''}{modelCode||rep.name}</span>
              <span style={{fontSize:11,color:'var(--text3)',marginLeft:6}}>{products.length} размеров</span>
            </div>
          </div>
        </td>
        <td>
          <div style={{display:'flex',gap:3,flexWrap:'wrap'}}>
            {products.map(p=>{
              const qty=p.stock?.reduce((a,st)=>a+st.quantity,0)||0;
              return <span key={p.id} style={{
                padding:'1px 6px',borderRadius:4,fontSize:11,fontWeight:700,
                background:qty===0?'rgba(255,77,109,0.12)':qty<=p.minStock?'rgba(255,179,0,0.12)':'rgba(0,212,170,0.1)',
                color:qty===0?'var(--red)':qty<=p.minStock?'var(--yellow)':'var(--text2)',
              }}>{p.size||'?'}<span style={{fontSize:9,marginLeft:2,opacity:0.7}}>×{qty}</span></span>;
            })}
          </div>
        </td>
        <td>{rep.category?.name||<span style={{color:'var(--text3)'}}>—</span>}</td>
        <td>{rep.unit}</td>
        <td><span style={{fontWeight:700,color:'var(--accent)'}}>{fmt(rep.salePrice)} с</span></td>
        <td><span style={{fontWeight:600,color:totalQty===0?'var(--red)':anyLow?'var(--yellow)':'var(--green)'}}>{totalQty}</span></td>
        <td></td>
      </tr>
      {expanded && products.map(p=>{
        const qty=p.stock?.reduce((a,st)=>a+st.quantity,0)||0;
        return (
          <tr key={p.id} style={{background:'rgba(0,212,170,0.025)'}}>
            <td style={{paddingLeft:32}}><span className="mono" style={{fontSize:11,color:'var(--text3)'}}>{p.sku}</span></td>
            <td style={{fontSize:13,color:'var(--text2)'}}>{p.name}</td>
            <td><span style={{
              background:qty===0?'rgba(255,77,109,0.15)':'var(--accent-dim,rgba(0,212,170,0.12))',
              color:qty===0?'var(--red)':'var(--accent)',
              padding:'2px 8px',borderRadius:5,fontSize:12,fontWeight:700
            }}>{p.size||'—'}</span></td>
            <td></td>
            <td style={{fontSize:12,color:'var(--text3)'}}>{p.unit}</td>
            <td style={{fontSize:13}}>{fmt(p.salePrice)} с</td>
            <td><span style={{fontWeight:600,color:qty===0?'var(--red)':qty<=p.minStock?'var(--yellow)':'var(--green)'}}>{qty}</span></td>
            <td style={{textAlign:'right'}}>
              <div style={{display:'flex',gap:4,justifyContent:'flex-end'}}>
                <button className="btn btn-ghost btn-sm btn-icon" onClick={e=>{e.stopPropagation();onEdit(p);}}><Edit2 size={14}/></button>
                <button className="btn btn-danger btn-sm btn-icon" onClick={e=>{e.stopPropagation();onDelete(p.id,p.name);}}><Trash2 size={14}/></button>
              </div>
            </td>
          </tr>
        );
      })}
    </>
  );
}

// ─── Главная страница ─────────────────────────────────────────────────────────
export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [search, setSearch] = useState('');
  const [filterSize, setFilterSize] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [groupByModel, setGroupByModel] = useState(true);
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(true);
  const { show } = useToast();
  const barcodeRef = useRef('');
  const barcodeTimer = useRef(null);

  useEffect(()=>{
    document.getElementById('page-title').textContent='Товары';
    load();
    const h = e=>{
      if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.tagName==='SELECT') return;
      if(e.key==='Enter'){ if(barcodeRef.current.length>3) setSearch(barcodeRef.current); barcodeRef.current=''; }
      else if(e.key.length===1){ barcodeRef.current+=e.key; clearTimeout(barcodeTimer.current); barcodeTimer.current=setTimeout(()=>{barcodeRef.current='';},300); }
    };
    window.addEventListener('keydown',h);
    return ()=>window.removeEventListener('keydown',h);
  },[]);

  const load = async()=>{
    setLoading(true);
    const [p,c,s,w] = await Promise.all([api('/products'),api('/categories'),api('/suppliers').catch(()=>[]),api('/warehouses').catch(()=>[])]);
    setProducts(p); setCategories(c); setSuppliers(s); setWarehouses(w);
    setLoading(false);
  };

  const handleDelete = async(id,name)=>{
    if(!confirm(`Удалить товар "${name}"?`)) return;
    try{ await api('/products/'+id,{method:'DELETE'}); show('Товар удалён','success'); load(); }
    catch(err){ show(err.message,'error'); }
  };

  const fmt = n=>new Intl.NumberFormat('ru-RU').format(n);

  const filtered = products.filter(p=>{
    const q=search.toLowerCase();
    return (!search||p.name.toLowerCase().includes(q)||p.sku.toLowerCase().includes(q)||(p.brand&&p.brand.toLowerCase().includes(q))||(p.modelCode&&p.modelCode.toLowerCase().includes(q)))
      && (!filterSize||p.size===filterSize)
      && (!filterBrand||p.brand===filterBrand);
  });

  const grouped = {};
  filtered.forEach(p=>{
    const key=(groupByModel&&p.modelCode)?p.modelCode:`_${p.id}`;
    if(!grouped[key]) grouped[key]=[];
    grouped[key].push(p);
  });

  const brands=[...new Set(products.map(p=>p.brand).filter(Boolean))];
  const sizes=[...new Set(products.map(p=>p.size).filter(Boolean))].sort((a,b)=>+a-+b);

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:16,flexWrap:'wrap'}}>
        <div className="search-bar" style={{flex:1,minWidth:200}}>
          <Search size={15} className="search-icon"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Поиск по названию, SKU, бренду..."/>
        </div>
        <select className="form-select" style={{width:110}} value={filterSize} onChange={e=>setFilterSize(e.target.value)}>
          <option value="">Все размеры</option>
          {sizes.map(s=><option key={s} value={s}>{s}</option>)}
        </select>
        {brands.length>0&&(
          <select className="form-select" style={{width:130}} value={filterBrand} onChange={e=>setFilterBrand(e.target.value)}>
            <option value="">Все бренды</option>
            {brands.map(b=><option key={b} value={b}>{b}</option>)}
          </select>
        )}
        <button className={`btn btn-sm ${groupByModel?'btn-primary':'btn-secondary'}`}
          onClick={()=>setGroupByModel(!groupByModel)} title="Группировать по модели">
          <Grid size={13}/> Сетка
        </button>
        <div style={{fontSize:12,color:'var(--text3)',display:'flex',alignItems:'center',gap:5}}>
          <Scan size={13}/> Сканер
        </div>
        <button className="btn btn-primary" onClick={()=>setModal({})}>
          <Plus size={15}/> Добавить товар
        </button>
      </div>

      <div style={{fontSize:12,color:'var(--text3)',marginBottom:12}}>
        Всего: <strong style={{color:'var(--text)'}}>{filtered.length}</strong> позиций
        {groupByModel&&<> · <strong style={{color:'var(--accent)'}}>{Object.keys(grouped).filter(k=>!k.startsWith('_')).length}</strong> моделей</>}
        {filtered.some(p=>(p.stock?.reduce((a,s)=>a+s.quantity,0)||0)===0)&&(
          <> · <span style={{color:'var(--red)'}}>{filtered.filter(p=>(p.stock?.reduce((a,s)=>a+s.quantity,0)||0)===0).length} нет в наличии</span></>
        )}
      </div>

      {loading?<div className="loader"><div className="spinner"/></div>:(
        <div className="card" style={{padding:0,overflow:'hidden'}}>
          {Object.keys(grouped).length===0?(
            <div className="empty-state">
              <div className="empty-icon">👟</div>
              <h3>Товары не найдены</h3>
              <p>Используйте «Добавить товар» — можно сразу создать всю размерную сетку</p>
            </div>
          ):(
            <table className="data-table">
              <thead>
                <tr>
                  <th>SKU</th><th>Наименование</th><th>Размер</th><th>Категория</th>
                  <th>Ед.</th><th>Цена</th><th>Остаток</th><th></th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(grouped).map(([key,prods])=>(
                  <ModelRow key={key}
                    modelCode={key.startsWith('_')?null:key}
                    products={prods}
                    onEdit={p=>setModal(p)}
                    onDelete={handleDelete}
                    fmt={fmt}/>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {modal!==null&&(
        <ProductModal
          product={modal.id?modal:null}
          categories={categories}
          suppliers={suppliers}
          warehouses={warehouses}
          onSave={()=>{setModal(null);load();}}
          onClose={()=>setModal(null)}
        />
      )}
    </div>
  );
}
