import React, { useEffect, useState } from 'react';
import { Search, AlertTriangle } from 'lucide-react';
import { api } from '../utils/api';
import { useAuth } from '../hooks/useAuth.jsx';

export default function StockPage() {
  const { user } = useAuth();
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [lowOnly, setLowOnly] = useState(false);

  useEffect(() => {
    document.getElementById('page-title').textContent = 'Остатки';
    load();
  }, [lowOnly]);

  const load = async () => {
    setLoading(true);
    const wid = user?.role !== 'admin' && user?.warehouseId ? `&warehouseId=${user.warehouseId}` : '';
    const data = await api(`/stock?${lowOnly ? 'lowStock=true' : ''}${wid}`);
    setStock(data);
    setLoading(false);
  };

  const filtered = stock.filter(s =>
    s.product.name.toLowerCase().includes(search.toLowerCase()) ||
    s.product.sku.toLowerCase().includes(search.toLowerCase())
  );

  const fmt = (n) => new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="search-bar">
          <Search size={15} className="search-icon" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск товара..." />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text2)' }}>
          <input type="checkbox" checked={lowOnly} onChange={e => setLowOnly(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
          Только мало остатков
        </label>
        <span style={{ marginLeft: 'auto', color: 'var(--text3)', fontSize: 12 }}>
          {filtered.length} позиций
        </span>
      </div>

      {loading ? <div className="loader"><div className="spinner" /></div> : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Товар</th>
                <th>Категория</th>
                <th>Склад</th>
                <th>Количество</th>
                <th>Ед.</th>
                <th>Ср. цена</th>
                <th>Сумма</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const isLow = s.quantity <= s.product.minStock;
                return (
                  <tr key={s.id}>
                    <td><span className="mono">{s.product.sku}</span></td>
                    <td><strong>{s.product.name}</strong></td>
                    <td style={{ color: 'var(--text2)' }}>{s.product.category?.name || '—'}</td>
                    <td style={{ color: 'var(--text2)' }}>{s.warehouse.name}</td>
                    <td style={{ fontWeight: 700, color: isLow ? 'var(--red)' : 'var(--green)' }}>
                      {fmt(s.quantity)}
                    </td>
                    <td style={{ color: 'var(--text3)' }}>{s.product.unit}</td>
                    <td>{fmt(s.avgCost)}</td>
                    <td style={{ fontWeight: 600 }}>{fmt(s.quantity * s.avgCost)}</td>
                    <td>
                      {isLow ? (
                        <span className="badge badge-red"><AlertTriangle size={10} style={{ marginRight: 3 }} />Мало</span>
                      ) : (
                        <span className="badge badge-green">OK</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--text3)', padding: 40 }}>
                  {stock.length === 0
                    ? '📦 Остатков нет. Создайте поступление товара и подтвердите его — остатки появятся здесь автоматически.'
                    : 'Товар не найден'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
