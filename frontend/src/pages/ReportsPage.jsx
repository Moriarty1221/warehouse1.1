import React, { useEffect, useState } from 'react';
import { Download, FileJson, FileSpreadsheet, BarChart2, Send } from 'lucide-react';
import { api, apiDownload } from '../utils/api';
import { useToast } from '../hooks/useToast.jsx';
import { useAuth } from '../hooks/useAuth.jsx';
import TelegramReportButton from '../components/TelegramReportButton.jsx';

export default function ReportsPage() {
  const { user } = useAuth();
  const { show } = useToast();
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tgLoading, setTgLoading] = useState(false);

  useEffect(() => {
    document.getElementById('page-title').textContent = 'Отчёты и экспорт';
    loadStock();
  }, []);

  const loadStock = async () => {
    const wid = user?.role !== 'admin' && user?.warehouseId ? `?warehouseId=${user.warehouseId}` : '';
    const data = await api(`/reports/stock${wid}`);
    setStock(data);
  };

  const exportFile = async (url, filename) => {
    setLoading(true);
    try { await apiDownload(url, filename); show('Файл загружен', 'success'); }
    catch (err) { show(err.message, 'error'); }
    finally { setLoading(false); }
  };

  const sendTelegram = async () => {
    setTgLoading(true);
    try {
      const warehouseId = user?.role !== 'admin' && user?.warehouseId ? user.warehouseId : undefined;
      await api('/reports/telegram', {
        method: 'POST',
        body: JSON.stringify({ warehouseId })
      });
      show('✅ Отчёт отправлен в Telegram!', 'success');
    } catch (err) {
      show('Ошибка отправки: ' + err.message, 'error');
    } finally {
      setTgLoading(false);
    }
  };

  const fmt = (n) => new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  const totalValue = stock.reduce((s, x) => s + x.quantity * x.avgCost, 0);
  const totalRevenue = stock.reduce((s, x) => s + x.quantity * x.product.price, 0);

  return (
    <div>
      <TelegramReportButton />

      {/* Export buttons */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Download size={17} /> Экспорт данных
        </h3>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={() => exportFile('/system/export/json', `warehouse_${Date.now()}.json`)} disabled={loading}>
            <FileJson size={15} /> Выгрузить всё — JSON
          </button>
          <button className="btn btn-secondary" onClick={() => exportFile('/system/export/excel', `warehouse_${Date.now()}.xlsx`)} disabled={loading}>
            <FileSpreadsheet size={15} /> Выгрузить всё — Excel
          </button>
          <button className="btn btn-secondary" onClick={() => exportFile('/reports/stock?format=excel', 'stock.xlsx')} disabled={loading}>
            <FileSpreadsheet size={15} /> Остатки — Excel
          </button>
          <button className="btn btn-secondary" onClick={() => exportFile('/reports/movements?format=excel', 'movements.xlsx')} disabled={loading}>
            <FileSpreadsheet size={15} /> Движение — Excel
          </button>
        </div>
      </div>

      {/* Stock summary */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <BarChart2 size={17} /> Остатки по складу
          </h3>
          <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
            <div style={{ color: 'var(--text2)' }}>
              Себестоимость: <strong style={{ color: 'var(--text1)' }}>{fmt(totalValue)} сом</strong>
            </div>
            <div style={{ color: 'var(--text2)' }}>
              Розница: <strong style={{ color: 'var(--accent2)' }}>{fmt(totalRevenue)} сом</strong>
            </div>
          </div>
        </div>
        <div style={{ overflow: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr><th>SKU</th><th>Товар</th><th>Склад</th><th>Кол-во</th><th>Ед.</th><th>Цена продажи</th><th>Ср.себест.</th><th>Сумма (розн.)</th><th>Статус</th></tr>
            </thead>
            <tbody>
              {stock.map(s => {
                const isLow = s.quantity <= s.product.minStock;
                return (
                  <tr key={s.id}>
                    <td className="mono">{s.product.sku}</td>
                    <td>{s.product.name}</td>
                    <td style={{ color: 'var(--text2)' }}>{s.warehouse.name}</td>
                    <td style={{ fontWeight: 700, color: isLow ? 'var(--red)' : 'var(--green)' }}>{fmt(s.quantity)}</td>
                    <td style={{ color: 'var(--text3)' }}>{s.product.unit}</td>
                    <td style={{ fontWeight: 600, color: 'var(--accent2)' }}>{fmt(s.product.price)}</td>
                    <td>{fmt(s.avgCost)}</td>
                    <td style={{ fontWeight: 600 }}>{fmt(s.quantity * s.product.price)}</td>
                    <td>{isLow ? <span className="badge badge-red">Мало</span> : <span className="badge badge-green">OK</span>}</td>
                  </tr>
                );
              })}
              {stock.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>Нет данных</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
