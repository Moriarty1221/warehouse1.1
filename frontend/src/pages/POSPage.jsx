import React, { useEffect, useState, useRef } from 'react';
import { ShoppingCart, Scan, Plus, Minus, Trash2, Printer, CreditCard, Banknote, X, Search } from 'lucide-react';
import { api } from '../utils/api';
import { useToast } from '../hooks/useToast.jsx';
import { useAuth } from '../hooks/useAuth.jsx';

// ──────────────────────────────────────────────
// Thermal receipt printer (ESC/POS via Web USB or network)
// ──────────────────────────────────────────────
async function printReceipt(receipt) {
  // Try Web USB first (direct USB thermal printer)
  if (navigator.usb) {
    try {
      const device = await navigator.usb.requestDevice({ filters: [] });
      await device.open();
      if (device.configuration === null) await device.selectConfiguration(1);
      await device.claimInterface(0);

      const encoder = new TextEncoder();
      const lines = buildEscPosData(receipt);
      const data = encoder.encode(lines);
      await device.transferOut(1, data);
      await device.close();
      return { method: 'usb' };
    } catch (e) {
      console.log('USB print failed, trying window.print:', e.message);
    }
  }

  // Fallback: browser print dialog (works with any printer incl. thermal)
  printViaWindow(receipt);
  return { method: 'window' };
}

function buildEscPosData(r) {
  // ESC/POS text format
  const ESC = '\x1B';
  const GS = '\x1D';
  const BOLD_ON  = ESC + 'E\x01';
  const BOLD_OFF = ESC + 'E\x00';
  const CENTER   = ESC + 'a\x01';
  const LEFT     = ESC + 'a\x00';
  const CUT      = GS  + 'V\x41\x03';
  const LINE     = '--------------------------------\n';

  const fmt = (n) => Number(n).toFixed(2);
  const pad = (l, r, w = 32) => {
    const space = w - l.length - r.length;
    return l + ' '.repeat(Math.max(1, space)) + r;
  };

  let out = '';
  out += CENTER + BOLD_ON + r.warehouse + '\n' + BOLD_OFF;
  out += CENTER + 'Кассовый чек\n';
  out += CENTER + new Date(r.date).toLocaleString('ru-RU') + '\n';
  out += LEFT + LINE;
  for (const item of r.items) {
    out += item.name + '\n';
    out += pad(`  ${fmt(item.quantity)} ${item.unit} x ${fmt(item.price)}`, fmt(item.total) + ' сом') + '\n';
  }
  out += LINE;
  out += BOLD_ON + pad('ИТОГО:', fmt(r.total) + ' сом') + BOLD_OFF + '\n';
  out += pad('Оплата (' + r.paymentMethod + '):', fmt(r.amountPaid) + ' сом') + '\n';
  if (r.change > 0) out += pad('Сдача:', fmt(r.change) + ' сом') + '\n';
  out += LINE;
  out += CENTER + 'Кассир: ' + r.cashier + '\n';
  out += CENTER + 'Чек #' + r.id + '\n';
  out += CENTER + 'Спасибо за покупку!\n\n\n';
  out += CUT;
  return out;
}

function printViaWindow(r) {
  const fmt = (n) => Number(n).toFixed(2);
  const html = `
    <html><head><title>Чек #${r.id}</title>
    <style>
      @page { margin: 0; size: 80mm auto; }
      body { font-family: 'Courier New', monospace; font-size: 11px; width: 72mm; margin: 4mm; color: #000; }
      h2 { text-align: center; font-size: 13px; margin: 0 0 2px; }
      .center { text-align: center; }
      .line { border-top: 1px dashed #000; margin: 4px 0; }
      .row { display: flex; justify-content: space-between; }
      .total { font-weight: bold; font-size: 13px; }
    </style></head><body>
    <h2>${r.warehouse}</h2>
    <div class="center">Кассовый чек</div>
    <div class="center">${new Date(r.date).toLocaleString('ru-RU')}</div>
    <div class="line"></div>
    ${r.items.map(i => `
      <div>${i.name}</div>
      <div class="row"><span>&nbsp;&nbsp;${fmt(i.quantity)} ${i.unit} × ${fmt(i.price)}</span><span>${fmt(i.total)} сом</span></div>
    `).join('')}
    <div class="line"></div>
    <div class="row total"><span>ИТОГО:</span><span>${fmt(r.total)} сом</span></div>
    <div class="row"><span>Оплата (${r.paymentMethod}):</span><span>${fmt(r.amountPaid)} сом</span></div>
    ${r.change > 0 ? `<div class="row"><span>Сдача:</span><span>${fmt(r.change)} сом</span></div>` : ''}
    <div class="line"></div>
    <div class="center">Кассир: ${r.cashier}</div>
    <div class="center">Чек #${r.id}</div>
    <div class="center" style="margin-top:6px;font-size:12px;">Спасибо за покупку!</div>
    </body></html>
  `;
  const win = window.open('', '_blank', 'width=340,height=600');
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 400);
}

// ──────────────────────────────────────────────
// Receipt modal shown after sale
// ──────────────────────────────────────────────
function ReceiptModal({ receipt, onClose }) {
  const fmt = (n) => Number(n).toFixed(2);

  const handlePrint = async () => {
    await printReceipt(receipt);
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <div className="modal-title">✅ Продажа проведена</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          {/* Receipt preview */}
          <div style={{
            background: 'white', color: '#111', borderRadius: 8, padding: '16px 20px',
            fontFamily: "'Courier New', monospace", fontSize: 13, lineHeight: 1.6
          }}>
            <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 15 }}>{receipt.warehouse}</div>
            <div style={{ textAlign: 'center', fontSize: 11, color: '#555' }}>Кассовый чек</div>
            <div style={{ textAlign: 'center', fontSize: 11, color: '#555', marginBottom: 8 }}>
              {new Date(receipt.date).toLocaleString('ru-RU')}
            </div>
            <div style={{ borderTop: '1px dashed #999', margin: '6px 0' }} />
            {receipt.items.map((item, i) => (
              <div key={i}>
                <div>{item.name}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: 12, color: '#444', fontSize: 12 }}>
                  <span>{fmt(item.quantity)} {item.unit} × {fmt(item.price)}</span>
                  <span>{fmt(item.total)} сом</span>
                </div>
              </div>
            ))}
            <div style={{ borderTop: '1px dashed #999', margin: '6px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 14 }}>
              <span>ИТОГО:</span><span>{fmt(receipt.total)} сом</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span>Оплата ({receipt.paymentMethod}):</span><span>{fmt(receipt.amountPaid)} сом</span>
            </div>
            {receipt.change > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span>Сдача:</span><span>{fmt(receipt.change)} сом</span>
              </div>
            )}
            <div style={{ borderTop: '1px dashed #999', margin: '6px 0' }} />
            <div style={{ textAlign: 'center', fontSize: 11 }}>Кассир: {receipt.cashier}</div>
            <div style={{ textAlign: 'center', fontSize: 11 }}>Чек #{receipt.id}</div>
            <div style={{ textAlign: 'center', fontWeight: 600, marginTop: 6 }}>Спасибо за покупку!</div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Закрыть</button>
          <button className="btn btn-primary" onClick={handlePrint}>
            <Printer size={15} /> Напечатать чек
          </button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Payment modal
// ──────────────────────────────────────────────
function PaymentModal({ total, onPay, onClose }) {
  const [method, setMethod] = useState('наличные');
  const [paid, setPaid] = useState('');
  const change = method === 'наличные' ? Math.max(0, (parseFloat(paid) || 0) - total) : 0;
  const fmt = (n) => Number(n).toFixed(2);

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 360 }}>
        <div className="modal-header">
          <div className="modal-title">Оплата</div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <div style={{ fontSize: 28, fontWeight: 800, textAlign: 'center', marginBottom: 20 }}>
            {fmt(total)} <span style={{ color: 'var(--text3)', fontSize: 16 }}>сом</span>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {['наличные', 'карта', 'перевод'].map(m => (
              <button
                key={m}
                className={`btn ${method === m ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => setMethod(m)}
              >
                {m === 'наличные' ? <Banknote size={14} /> : <CreditCard size={14} />}
                {m}
              </button>
            ))}
          </div>

          {method === 'наличные' && (
            <>
              <div className="form-group">
                <label className="form-label">Сумма от покупателя</label>
                <input
                  className="form-input"
                  type="number"
                  value={paid}
                  onChange={e => setPaid(e.target.value)}
                  placeholder={fmt(total)}
                  autoFocus
                  style={{ fontSize: 18, textAlign: 'center' }}
                />
              </div>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '12px 16px', background: 'var(--bg3)', borderRadius: 8,
                fontWeight: 700, fontSize: 18
              }}>
                <span style={{ color: 'var(--text2)' }}>Сдача:</span>
                <span style={{ color: change > 0 ? 'var(--green)' : 'var(--text)' }}>{fmt(change)} сом</span>
              </div>
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Отмена</button>
          <button
            className="btn btn-primary"
            style={{ fontSize: 15, padding: '10px 24px' }}
            onClick={() => onPay(method, parseFloat(paid) || total, change)}
            disabled={method === 'наличные' && (parseFloat(paid) || 0) < total}
          >
            ✓ Провести оплату
          </button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Main POS page
// ──────────────────────────────────────────────
export default function POSPage() {
  const { user } = useAuth();
  const { show } = useToast();
  const [products, setProducts] = useState([]);
  const [stock, setStock] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState(user?.warehouseId || '');
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [scan, setScan] = useState('');
  const [payModal, setPayModal] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(false);
  const scanRef = useRef('');
  const scanTimer = useRef(null);
  const scanInputRef = useRef(null);

  useEffect(() => {
    document.getElementById('page-title').textContent = 'Касса / POS';
    api('/products').then(setProducts);
    api('/warehouses').then(setWarehouses);

    // Global barcode scanner listener (HID keyboard — fast input)
    const handleKey = (e) => {
      if (e.target === scanInputRef.current) return; // handled separately
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'Enter') {
        if (scanRef.current.length > 2) handleBarcode(scanRef.current);
        scanRef.current = '';
      } else if (e.key.length === 1) {
        scanRef.current += e.key;
        clearTimeout(scanTimer.current);
        scanTimer.current = setTimeout(() => { scanRef.current = ''; }, 300);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [warehouseId]);

  // Load stock when warehouse is selected
  useEffect(() => {
    if (warehouseId) {
      api(`/stock?warehouseId=${warehouseId}`).then(setStock).catch(() => setStock([]));
    } else {
      setStock([]);
    }
  }, [warehouseId]);

  const handleBarcode = (sku) => {
    const product = products.find(p => p.sku === sku.trim());
    if (product) {
      addToCart(product);
      show(`➕ ${product.name}`, 'success');
    } else {
      show('Товар не найден: ' + sku, 'error');
    }
    setScan('');
  };

  const handleScanInput = (e) => {
    if (e.key === 'Enter') { handleBarcode(scan); }
  };

  const addToCart = (product) => {
    setCart(prev => {
      const ex = prev.find(i => i.productId === product.id);
      if (ex) return prev.map(i => i.productId === product.id ? { ...i, qty: i.qty + 1 } : i);
      // Use salePrice (backend field). product.price is legacy alias from some responses.
      const price = product.salePrice || product.price || 0;
      return [...prev, { productId: product.id, name: product.name, sku: product.sku, unit: product.unit, price, qty: 1 }];
    });
  };

  const updateQty = (productId, delta) => {
    setCart(prev => prev.map(i => i.productId === productId
      ? { ...i, qty: Math.max(0, i.qty + delta) }
      : i).filter(i => i.qty > 0));
  };

  const setPrice = (productId, price) => {
    setCart(prev => prev.map(i => i.productId === productId ? { ...i, price: parseFloat(price) || 0 } : i));
  };

  const removeFromCart = (productId) => setCart(prev => prev.filter(i => i.productId !== productId));

  const total = cart.reduce((sum, i) => sum + i.qty * i.price, 0);
  const fmt = (n) => Number(n).toFixed(2);

  const handlePay = async (method, amountPaid, change) => {
    if (!warehouseId) return show('Выберите склад', 'error');
    setLoading(true);
    try {
      const res = await api('/pos/sale', {
        method: 'POST',
        body: JSON.stringify({
          warehouseId: +warehouseId,
          items: cart.map(i => ({ productId: i.productId, quantity: i.qty, salePrice: i.price, costPrice: 0 })),
          cashierName: user?.fullName,
          paymentMethod: method,
          amountPaid
        })
      });
      setCart([]);
      setPayModal(false);
      setReceipt(res.receipt);
      show('Продажа проведена!', 'success');
      // Auto-send receipt to Telegram (silent if not configured)
      api('/reports/telegram/receipt', { method: 'POST', body: JSON.stringify({ receipt: res.receipt }) }).catch(() => {});
    } catch (err) {
      show(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Merge products with stock quantities for selected warehouse
  const productsWithStock = products.map(p => {
    const stockItem = stock.find(s => s.productId === p.id);
    return { ...p, stockQuantity: stockItem ? stockItem.quantity : 0 };
  });

  const filtered = productsWithStock.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.includes(search)
  ).slice(0, 40);

  return (
    <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 96px)' }}>

      {/* Left: product catalog */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>

        {/* Warehouse + scan bar */}
        <div style={{ display: 'flex', gap: 10 }}>
          <select
            className="form-select"
            style={{ maxWidth: 200 }}
            value={warehouseId}
            onChange={e => setWarehouseId(e.target.value)}
          >
            <option value="">Выберите склад</option>
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>

          <div style={{ position: 'relative', flex: 1 }}>
            <Scan size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
            <input
              ref={scanInputRef}
              className="form-input"
              style={{ paddingLeft: 34 }}
              value={scan}
              onChange={e => setScan(e.target.value)}
              onKeyDown={handleScanInput}
              placeholder="Сканер или SKU + Enter"
            />
          </div>

          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
            <input
              className="form-input"
              style={{ paddingLeft: 34 }}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Поиск товара..."
            />
          </div>
        </div>

        {/* Product grid */}
        <div style={{
          flex: 1, overflowY: 'auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
          gap: 8, alignContent: 'start'
        }}>
          {filtered.map(p => {
            const hasStock = !warehouseId || p.stockQuantity > 0;
            return (
            <button
              key={p.id}
              onClick={() => addToCart(p)}
              disabled={!hasStock}
              style={{
                background: hasStock ? 'var(--bg2)' : 'var(--bg3)', border: `1px solid ${hasStock ? 'var(--border)' : 'var(--red)'}`,
                borderRadius: 10, padding: '12px 10px', cursor: hasStock ? 'pointer' : 'not-allowed',
                textAlign: 'left', transition: 'all 0.15s', color: hasStock ? 'var(--text)' : 'var(--text3)',
                opacity: hasStock ? 1 : 0.5
              }}
              onMouseEnter={e => { if (hasStock) { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-glow)'; }}}
              onMouseLeave={e => { if (hasStock) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg2)'; }}}
            >
              <div style={{ fontSize: 24, marginBottom: 6 }}>📦</div>
              <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3, marginBottom: 4 }}>{p.name}</div>
              <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'monospace' }}>{p.sku}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent2)', marginTop: 6 }}>
                {fmt(p.salePrice || p.price || 0)} сом
              </div>
              {warehouseId && (
                <div style={{ fontSize: 10, color: hasStock ? 'var(--green)' : 'var(--red)', marginTop: 2 }}>
                  {hasStock ? `В наличии: ${p.stockQuantity} ${p.unit}` : 'Нет на складе'}
                </div>
              )}
            </button>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
              Товары не найдены
            </div>
          )}
        </div>
      </div>

      {/* Right: cart */}
      <div style={{
        width: 340, background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: 12, display: 'flex', flexDirection: 'column', flexShrink: 0
      }}>
        {/* Cart header */}
        <div style={{
          padding: '14px 16px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 8
        }}>
          <ShoppingCart size={18} />
          <span style={{ fontWeight: 700, fontSize: 15 }}>Корзина</span>
          <span style={{
            marginLeft: 'auto', background: 'var(--accent)', color: 'white',
            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999
          }}>{cart.length}</span>
        </div>

        {/* Cart items */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
          {cart.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text3)' }}>
              <ShoppingCart size={32} style={{ marginBottom: 10, opacity: 0.3 }} />
              <div>Добавьте товары из каталога или отсканируйте штрихкод</div>
            </div>
          ) : cart.map(item => (
            <div key={item.productId} style={{
              background: 'var(--bg3)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '10px 12px', marginBottom: 8
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 600, flex: 1, marginRight: 8 }}>{item.name}</div>
                <button className="btn btn-danger btn-sm btn-icon" onClick={() => removeFromCart(item.productId)}>
                  <Trash2 size={12} />
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Qty controls */}
                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => updateQty(item.productId, -1)}>
                  <Minus size={13} />
                </button>
                <span style={{ fontWeight: 700, minWidth: 24, textAlign: 'center' }}>{item.qty}</span>
                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => updateQty(item.productId, 1)}>
                  <Plus size={13} />
                </button>
                <span style={{ color: 'var(--text3)', fontSize: 11 }}>{item.unit}</span>

                {/* Price input */}
                <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input
                    type="number"
                    value={item.price}
                    onChange={e => setPrice(item.productId, e.target.value)}
                    style={{
                      width: 70, background: 'var(--bg)', border: '1px solid var(--border)',
                      borderRadius: 5, color: 'var(--text)', padding: '3px 6px', fontSize: 12,
                      fontFamily: 'inherit', outline: 'none', textAlign: 'right'
                    }}
                  />
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>сом</span>
                </span>
              </div>
              <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--accent2)', marginTop: 4, fontWeight: 600 }}>
                = {fmt(item.qty * item.price)} сом
              </div>
            </div>
          ))}
        </div>

        {/* Cart footer */}
        <div style={{ padding: 16, borderTop: '1px solid var(--border)' }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            fontSize: 22, fontWeight: 800, marginBottom: 14
          }}>
            <span>Итого:</span>
            <span style={{ color: 'var(--accent2)' }}>{fmt(total)} сом</span>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-secondary"
              onClick={() => setCart([])}
              disabled={cart.length === 0}
              style={{ flex: 1, justifyContent: 'center' }}
            >
              <Trash2 size={14} /> Очистить
            </button>
            <button
              className="btn btn-primary"
              onClick={() => setPayModal(true)}
              disabled={cart.length === 0 || !warehouseId || loading}
              style={{ flex: 2, justifyContent: 'center', fontSize: 15 }}
            >
              <Banknote size={16} /> Оплатить
            </button>
          </div>
        </div>
      </div>

      {/* Payment modal */}
      {payModal && (
        <PaymentModal
          total={total}
          onPay={handlePay}
          onClose={() => setPayModal(false)}
        />
      )}

      {/* Receipt modal with print button */}
      {receipt && (
        <ReceiptModal
          receipt={receipt}
          onClose={() => setReceipt(null)}
        />
      )}
    </div>
  );
}
