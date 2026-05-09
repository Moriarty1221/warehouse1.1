import React, { useEffect, useState } from 'react';
import { Plus, CheckCircle, XCircle, ArrowLeftRight, Search, AlertCircle, Info } from 'lucide-react';
import { api } from '../utils/api';
import { useToast } from '../hooks/useToast.jsx';
import { useAuth } from '../hooks/useAuth.jsx';

function Hint({ type = 'info', children }) {
  const colors = {
    info: { bg: 'rgba(0,180,216,0.08)', border: 'var(--accent)', color: 'var(--accent)', icon: <Info size={12}/> },
    warn: { bg: 'rgba(255,180,0,0.10)', border: 'var(--yellow,#f59e0b)', color: 'var(--yellow,#f59e0b)', icon: <AlertCircle size={12}/> },
  };
  const s = colors[type] || colors.info;
  return (
    <div style={{ display:'flex', alignItems:'flex-start', gap:6, marginTop:4, padding:'5px 9px', borderRadius:6, background:s.bg, border:'1px solid '+s.border, color:s.color, fontSize:12, lineHeight:1.4 }}>
      {s.icon}<span>{children}</span>
    </div>
  );
}

function TransferModal({ warehouses, products, onSave, onClose }) {
  const [form, setForm] = useState({ fromWarehouseId: '', toWarehouseId: '', notes: '', items: [] });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [stock, setStock] = useState({});
  const { show } = useToast();

  // Load stock when source warehouse changes
  useEffect(() => {
    if (!form.fromWarehouseId) { setStock({}); return; }
    api('/stock?warehouseId=' + form.fromWarehouseId).then(data => {
      const map = {};
      data.forEach(s => { map[s.productId] = s.quantity; });
      setStock(map);
    }).catch(() => {});
  }, [form.fromWarehouseId]);

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const addItem = (product) => {
    if (form.items.find(i => i.productId === product.id)) return;
    const avail = stock[product.id] || 0;
    setForm(f => ({ ...f, items: [...f.items, { productId: product.id, product, quantity: 1, available: avail }] }));
    setSearch('');
  };

  const updateQty = (productId, qty) => {
    setForm(f => ({ ...f, items: f.items.map(i => i.productId === productId ? { ...i, quantity: Math.max(0.1, +qty) } : i) }));
  };

  const removeItem = (productId) => {
    setForm(f => ({ ...f, items: f.items.filter(i => i.productId !== productId) }));
  };

  const handleSave = async () => {
    if (!form.fromWarehouseId) return show('Выберите склад-отправитель', 'error');
    if (!form.toWarehouseId) return show('Выберите склад-получатель', 'error');
    if (form.fromWarehouseId === form.toWarehouseId) return show('Склад-отправитель и получатель не могут совпадать', 'error');
    if (form.items.length === 0) return show('Добавьте хотя бы один товар в перемещение', 'error');

    // Check quantities
    for (const item of form.items) {
      const avail = stock[item.productId] || 0;
      if (item.quantity > avail) {
        return show('Недостаточно остатков: «' + item.product.name + '» — доступно ' + avail + ', запрошено ' + item.quantity, 'error');
      }
    }

    setLoading(true);
    try {
      await api('/transfers', {
        method: 'POST',
        body: JSON.stringify({
          fromWarehouseId: +form.fromWarehouseId,
          toWarehouseId: +form.toWarehouseId,
          notes: form.notes,
          items: form.items.map(i => ({ productId: i.productId, quantity: i.quantity }))
        })
      });
      show('Перемещение создано (черновик). Проведите его для обновления остатков.', 'success');
      onSave();
    } catch (err) { show(err.message, 'error'); }
    finally { setLoading(false); }
  };

  const fromName = warehouses.find(w => w.id === +form.fromWarehouseId)?.name;
  const toName = warehouses.find(w => w.id === +form.toWarehouseId)?.name;

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth:700, width:'95%' }}>
        <div className="modal-header">
          <div className="modal-title">Новое перемещение между складами</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">

          <Hint type="info">
            Перемещение создаётся как черновик. Остатки изменятся только после нажатия «Провести» администратором.
          </Hint>

          <div className="form-row" style={{ marginTop:12 }}>
            <div className="form-group">
              <label className="form-label">Откуда (склад-отправитель) *</label>
              <select className="form-select" value={form.fromWarehouseId}
                onChange={e => setForm(f => ({ ...f, fromWarehouseId: e.target.value, toWarehouseId: '', items: [] }))}>
                <option value="">Выберите склад</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              {!form.fromWarehouseId && <div style={{ fontSize:11, color:'var(--text3)', marginTop:3 }}>Выберите склад, с которого отправляются товары</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Куда (склад-получатель) *</label>
              <select className="form-select" value={form.toWarehouseId}
                onChange={e => setForm(f => ({ ...f, toWarehouseId: e.target.value }))}>
                <option value="">Выберите склад</option>
                {warehouses.filter(w => w.id !== +form.fromWarehouseId).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              {form.fromWarehouseId && !form.toWarehouseId && <div style={{ fontSize:11, color:'var(--text3)', marginTop:3 }}>Выберите склад назначения (отличный от отправителя)</div>}
            </div>
          </div>

          {form.fromWarehouseId && form.toWarehouseId && form.fromWarehouseId !== form.toWarehouseId && (
            <Hint type="info">Маршрут: <strong>{fromName}</strong> → <strong>{toName}</strong></Hint>
          )}

          {/* Product search */}
          <div className="form-group" style={{ marginTop:12 }}>
            <label className="form-label">Добавить товар в перемещение</label>
            {!form.fromWarehouseId ? (
              <Hint type="warn">Сначала выберите склад-отправитель, чтобы видеть доступные остатки</Hint>
            ) : (
              <>
                <div className="search-bar" style={{ marginBottom:8 }}>
                  <Search size={14} className="search-icon" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по названию или SKU..." />
                </div>
                {search.length > 0 && (
                  <div style={{ border:'1px solid var(--border)', borderRadius:8, maxHeight:160, overflow:'auto', background:'var(--bg2)' }}>
                    {filteredProducts.slice(0, 20).map(p => {
                      const avail = stock[p.id] || 0;
                      const already = form.items.find(i => i.productId === p.id);
                      return (
                        <div key={p.id} onClick={() => !already && addItem(p)}
                          style={{ padding:'8px 12px', cursor: already ? 'default' : 'pointer', display:'flex', justifyContent:'space-between', alignItems:'center', opacity: already ? 0.5 : 1 }}
                          onMouseEnter={e => !already && (e.currentTarget.style.background = 'var(--bg3)')}
                          onMouseLeave={e => (e.currentTarget.style.background = '')}>
                          <span>{p.name} {already && '(уже добавлен)'}</span>
                          <span style={{ fontSize:11, color: avail > 0 ? 'var(--green)' : 'var(--red)' }}>
                            {avail > 0 ? 'в наличии: ' + avail : 'нет остатков'}
                          </span>
                        </div>
                      );
                    })}
                    {filteredProducts.length === 0 && <div style={{ padding:12, color:'var(--text3)', fontSize:13 }}>Ничего не найдено</div>}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Items table */}
          {form.items.length > 0 && (
            <table className="data-table" style={{ marginBottom:12 }}>
              <thead>
                <tr><th>Товар</th><th>SKU</th><th>Доступно</th><th style={{ width:120 }}>Кол-во</th><th></th></tr>
              </thead>
              <tbody>
                {form.items.map(item => {
                  const avail = stock[item.productId] || 0;
                  const overQty = item.quantity > avail;
                  return (
                    <tr key={item.productId}>
                      <td>{item.product.name}</td>
                      <td className="mono">{item.product.sku}</td>
                      <td style={{ color: avail > 0 ? 'var(--green)' : 'var(--red)', fontWeight:600 }}>{avail}</td>
                      <td>
                        <input type="number" className="form-input" value={item.quantity} min="0.1" step="1"
                          onChange={e => updateQty(item.productId, e.target.value)}
                          style={{ padding:'4px 8px', width:80, borderColor: overQty ? 'var(--red)' : '' }} />
                        {overQty && <div style={{ fontSize:11, color:'var(--red)', marginTop:2 }}>Превышает остаток!</div>}
                      </td>
                      <td><button className="btn btn-danger btn-sm btn-icon" onClick={() => removeItem(item.productId)}><XCircle size={14} /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {form.items.length === 0 && form.fromWarehouseId && (
            <Hint type="warn">Список товаров пуст — воспользуйтесь поиском выше для добавления</Hint>
          )}

          <div className="form-group">
            <label className="form-label">Примечание</label>
            <textarea className="form-textarea" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Необязательно" rows={2} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
            {loading ? 'Создание...' : 'Создать перемещение'}
          </button>
        </div>
      </div>
    </div>
  );
}

const STATUS_LABELS = { draft: ['Черновик', 'badge-yellow'], confirmed: ['Проведено', 'badge-green'], cancelled: ['Отменено', 'badge-red'] };

export default function TransfersPage() {
  const { user } = useAuth();
  const { show } = useToast();
  const [transfers, setTransfers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    document.getElementById('page-title').textContent = 'Перемещение';
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    const wid = user?.role !== 'admin' && user?.warehouseId ? '?warehouseId=' + user.warehouseId : '';
    const [t, w, p] = await Promise.all([api('/transfers' + wid), api('/warehouses'), api('/products')]);
    setTransfers(t); setWarehouses(w); setProducts(p);
    setLoading(false);
  };

  const confirm = async (id) => {
    try {
      await api('/transfers/' + id + '/confirm', { method: 'POST' });
      show('Перемещение проведено — остатки обновлены', 'success');
      load();
    } catch (err) { show(err.message, 'error'); }
  };

  const cancel = async (id) => {
    if (!window.confirm('Отменить перемещение?')) return;
    try {
      await api('/transfers/' + id + '/cancel', { method: 'POST' });
      show('Отменено', 'success');
      load();
    } catch (err) { show(err.message, 'error'); }
  };

  const fmt = d => new Date(d).toLocaleDateString('ru-RU', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:16 }}>
        <button className="btn btn-primary" onClick={() => setModal(true)}>
          <Plus size={15} /> Новое перемещение
        </button>
      </div>

      {loading ? <div className="loader"><div className="spinner" /></div> : (
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          {transfers.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><ArrowLeftRight size={40} /></div>
              <h3>Перемещений нет</h3>
              <p>Создайте первое перемещение между складами</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr><th>#</th><th>Дата</th><th>Откуда</th><th>Куда</th><th>Товаров</th><th>Статус</th><th>Кем</th><th></th></tr>
              </thead>
              <tbody>
                {transfers.map(t => {
                  const [label, badge] = STATUS_LABELS[t.status] || ['—', ''];
                  const totalQty = t.items.reduce((s, i) => s + i.quantity, 0);
                  return (
                    <React.Fragment key={t.id}>
                      <tr style={{ cursor:'pointer' }} onClick={() => setExpanded(expanded === t.id ? null : t.id)}>
                        <td className="mono">#{t.id}</td>
                        <td style={{ fontSize:12 }}>{fmt(t.date)}</td>
                        <td style={{ fontWeight:600, color:'var(--red)' }}>{t.fromWarehouse.name}</td>
                        <td style={{ fontWeight:600, color:'var(--green)' }}>{t.toWarehouse.name}</td>
                        <td>{t.items.length} поз. / {totalQty} пар</td>
                        <td><span className={'badge ' + badge}>{label}</span></td>
                        <td style={{ fontSize:12, color:'var(--text3)' }}>{t.user?.fullName}</td>
                        <td>
                          {t.status === 'draft' && (user?.role === 'admin' || user?.role === 'manager') && (
                            <div style={{ display:'flex', gap:4 }}>
                              <button className="btn btn-primary btn-sm" onClick={e => { e.stopPropagation(); confirm(t.id); }} title="Провести — спишет остатки со склада-отправителя">
                                <CheckCircle size={13} /> Провести
                              </button>
                              <button className="btn btn-danger btn-sm" onClick={e => { e.stopPropagation(); cancel(t.id); }} title="Отменить перемещение">
                                <XCircle size={13} />
                              </button>
                            </div>
                          )}
                          {t.status === 'draft' && user?.role === 'operator' && (
                            <span style={{ fontSize:11, color:'var(--text3)' }}>Ожидает проводки</span>
                          )}
                        </td>
                      </tr>
                      {expanded === t.id && (
                        <tr>
                          <td colSpan={8} style={{ background:'var(--bg2)', padding:'8px 16px' }}>
                            <table style={{ width:'100%', fontSize:13 }}>
                              <thead>
                                <tr style={{ color:'var(--text3)' }}>
                                  <th style={{ textAlign:'left', paddingBottom:4 }}>SKU</th>
                                  <th style={{ textAlign:'left', paddingBottom:4 }}>Товар</th>
                                  <th style={{ textAlign:'right', paddingBottom:4 }}>Кол-во</th>
                                </tr>
                              </thead>
                              <tbody>
                                {t.items.map(i => (
                                  <tr key={i.id}>
                                    <td className="mono" style={{ paddingRight:16 }}>{i.product.sku}</td>
                                    <td>{i.product.name}</td>
                                    <td style={{ textAlign:'right', fontWeight:600 }}>{i.quantity} {i.product.unit}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {t.notes && <div style={{ marginTop:8, color:'var(--text3)', fontSize:12 }}>💬 {t.notes}</div>}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {modal && (
        <TransferModal
          warehouses={warehouses}
          products={products}
          onSave={() => { setModal(false); load(); }}
          onClose={() => setModal(false)}
        />
      )}
    </div>
  );
}
