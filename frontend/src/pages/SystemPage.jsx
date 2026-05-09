import React, { useEffect, useState, useRef } from 'react';
import { HardDrive, Trash2, Download, FileJson, FileSpreadsheet, AlertTriangle, Shield, Upload, CheckCircle, AlertCircle } from 'lucide-react';
import { api, apiDownload } from '../utils/api';
import { useToast } from '../hooks/useToast.jsx';

export default function SystemPage() {
  const { show } = useToast();
  const [disk, setDisk] = useState(null);
  const [clearOpts, setClearOpts] = useState({ clearReceipts:false, clearIssues:false, clearStock:false, clearAudit:true, olderThanDays:90 });
  const [clearing, setClearing] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileRef = useRef();

  useEffect(() => {
    document.getElementById('page-title').textContent = 'Система';
    loadDisk();
    const interval = setInterval(loadDisk, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadDisk = async () => {
    try { setDisk(await api('/system/disk')); } catch {}
  };

  const handleExport = async (type) => {
    setExporting(true);
    try {
      if (type === 'json') await apiDownload('/system/export/json', 'warehouse_backup_' + new Date().toISOString().slice(0,10) + '.json');
      else await apiDownload('/system/export/excel', 'warehouse_backup_' + new Date().toISOString().slice(0,10) + '.xlsx');
      show('Файл успешно скачан', 'success');
    } catch (err) { show('Ошибка выгрузки: ' + err.message, 'error'); }
    finally { setExporting(false); }
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.json')) {
      show('Ошибка: можно загружать только JSON-файлы (.json)', 'error');
      return;
    }
    setImporting(true);
    setImportResult(null);
    try {
      const text = await file.text();
      let data;
      try { data = JSON.parse(text); }
      catch { show('Ошибка: файл повреждён или не является корректным JSON', 'error'); setImporting(false); return; }
      const res = await api('/system/import/json', { method: 'POST', body: JSON.stringify(data) });
      setImportResult(res);
      show('Импорт завершён успешно!', 'success');
    } catch (err) {
      show('Ошибка импорта: ' + err.message, 'error');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const handleClearAll = async () => {
    const confirmed = window.confirm(
      '⚠️ ПОЛНАЯ ОЧИСТКА ВСЕХ ДАННЫХ ⚠️\n\n' +
      'Будут удалены ВСЕ товары, остатки, приходы, расходы, перемещения и журнал аудита.\n\n' +
      'Это действие НЕОБРАТИМО!\n\n' +
      'Введите "УДАЛИТЬ" для подтверждения:'
    );
    if (!confirmed) return;
    const code = window.prompt('Введите слово УДАЛИТЬ для подтверждения:');
    if (code !== 'УДАЛИТЬ') { show('Отменено — слово не совпало', 'error'); return; }
    setClearingAll(true);
    try {
      const res = await api('/system/clear-all', { method: 'POST' });
      show('Все данные полностью удалены', 'success');
      loadDisk();
    } catch (err) { show('Ошибка полной очистки: ' + err.message, 'error'); }
    finally { setClearingAll(false); }
  };

  const handleClear = async () => {
    const selected = Object.entries(clearOpts).filter(([k,v]) => k !== 'olderThanDays' && v).map(([k]) => k);
    if (selected.length === 0) { show('Выберите хотя бы один тип данных для очистки', 'error'); return; }
    if (!confirm('Очистить выбранные данные? Это действие необратимо!')) return;
    setClearing(true);
    try {
      const res = await api('/system/clear', { method:'POST', body: JSON.stringify(clearOpts) });
      const parts = [];
      if (res.cleared.receipts) parts.push('Приходов: ' + res.cleared.receipts);
      if (res.cleared.issues) parts.push('Расходов: ' + res.cleared.issues);
      if (res.cleared.auditLog) parts.push('Аудит: ' + res.cleared.auditLog);
      if (res.cleared.zeroStock) parts.push('Нулевых остатков: ' + res.cleared.zeroStock);
      show('Очищено: ' + (parts.join(', ') || 'ничего не найдено'), 'success');
      loadDisk();
    } catch (err) { show('Ошибка очистки: ' + err.message, 'error'); }
    finally { setClearing(false); }
  };

  const diskColor = !disk ? 'var(--text3)' : disk.blocked ? 'var(--red)' : disk.critical ? 'var(--orange)' : disk.warning ? 'var(--yellow)' : 'var(--green)';

  return (
    <div>
      {/* Disk usage */}
      <div className="card" style={{ marginBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
          <HardDrive size={18} />
          <h3 style={{ fontSize:15, fontWeight:700 }}>Использование диска</h3>
          {disk?.blocked && <span className="badge badge-red">🔒 Запись заблокирована</span>}
          {disk?.critical && !disk?.blocked && <span className="badge badge-red">Критично</span>}
          {disk?.warning && !disk?.critical && <span className="badge badge-yellow">Предупреждение</span>}
        </div>
        {disk ? (
          <>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
              <span style={{ color:'var(--text2)' }}>Занято:</span>
              <span style={{ fontWeight:700, fontSize:18, color:diskColor }}>{disk.usage}%</span>
            </div>
            <div className="disk-bar"><div className="disk-bar-fill" style={{ width: disk.usage+'%', background:diskColor }} /></div>
            <div style={{ display:'flex', gap:20, marginTop:10, fontSize:12, color:'var(--text3)' }}>
              <span>🟡 70% — предупреждение</span><span>🟠 90% — критично</span><span>🔴 95% — блокировка записи</span>
            </div>
          </>
        ) : <div style={{ color:'var(--text3)' }}>Загрузка...</div>}
        {disk?.warning && (
          <div className={'alert ' + (disk.blocked || disk.critical ? 'alert-danger' : 'alert-warning')} style={{ marginTop:14, marginBottom:0 }}>
            <AlertTriangle size={15} />
            <div>
              <strong>{disk.blocked ? '⛔ Сервер заполнен — запись заблокирована!' : '⚠️ Диск заполняется!'}</strong>
              <br/>Рекомендуется выгрузить данные в JSON, затем очистить старые записи.
            </div>
          </div>
        )}
      </div>

      {/* Export */}
      <div className="card" style={{ marginBottom:16 }}>
        <h3 style={{ fontSize:15, fontWeight:700, marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
          <Download size={17} /> Резервная выгрузка данных
        </h3>
        <p style={{ color:'var(--text2)', fontSize:13, marginBottom:14 }}>
          Перед очисткой <strong>обязательно</strong> сохраните все данные. JSON-бэкап можно восстановить через раздел «Импорт» ниже.
        </p>
        <div style={{ display:'flex', gap:10 }}>
          <button className="btn btn-primary" onClick={() => handleExport('json')} disabled={exporting}>
            <FileJson size={15} /> Скачать JSON (полный бэкап)
          </button>
          <button className="btn btn-secondary" onClick={() => handleExport('excel')} disabled={exporting}>
            <FileSpreadsheet size={15} /> Скачать Excel
          </button>
        </div>
      </div>

      {/* Import JSON */}
      <div className="card" style={{ marginBottom:16 }}>
        <h3 style={{ fontSize:15, fontWeight:700, marginBottom:8, display:'flex', alignItems:'center', gap:8 }}>
          <Upload size={17} /> Импорт из JSON-бэкапа
        </h3>
        <p style={{ color:'var(--text2)', fontSize:13, marginBottom:12 }}>
          Загрузите ранее скачанный JSON-файл. Существующие записи не будут перезаписаны — добавятся только новые.
        </p>
        <input ref={fileRef} type="file" accept=".json" style={{ display:'none' }} onChange={handleImportFile} />
        <button className="btn btn-secondary" onClick={() => fileRef.current.click()} disabled={importing}>
          <Upload size={15} /> {importing ? 'Загрузка...' : 'Выбрать JSON-файл'}
        </button>

        {importResult && (
          <div style={{ marginTop:12, padding:'10px 14px', borderRadius:8, background:'rgba(0,200,100,0.08)', border:'1px solid var(--green)', fontSize:13 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, fontWeight:700, color:'var(--green)', marginBottom:6 }}>
              <CheckCircle size={14} /> Импорт завершён успешно
            </div>
            <div style={{ color:'var(--text2)' }}>
              Добавлено: категорий — {importResult.stats.categories}, поставщиков — {importResult.stats.suppliers},
              складов — {importResult.stats.warehouses}, товаров — {importResult.stats.products}, остатков — {importResult.stats.stock}
            </div>
          </div>
        )}
      </div>

      {/* Selective cleanup */}
      <div className="card" style={{ marginBottom:16 }}>
        <h3 style={{ fontSize:15, fontWeight:700, marginBottom:6, display:'flex', alignItems:'center', gap:8 }}>
          <Trash2 size={17} /> Выборочная очистка
        </h3>
        <p style={{ color:'var(--text2)', fontSize:13, marginBottom:16 }}>
          Удаление старых подтверждённых документов. Товары, текущие остатки и черновики не удаляются.
        </p>
        <div style={{ display:'flex', gap:16, flexWrap:'wrap', marginBottom:16 }}>
          {[
            { key:'clearReceipts', label:'🟢 Подтверждённые приходы' },
            { key:'clearIssues',   label:'🟠 Подтверждённые расходы' },
            { key:'clearAudit',    label:'📋 Журнал аудита' },
            { key:'clearStock',    label:'📦 Нулевые остатки' },
          ].map(opt => (
            <label key={opt.key} style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:13 }}>
              <input type="checkbox" checked={clearOpts[opt.key]}
                onChange={e => setClearOpts(p => ({ ...p, [opt.key]: e.target.checked }))}
                style={{ accentColor:'var(--accent)', width:16, height:16 }} />
              {opt.label}
            </label>
          ))}
        </div>
        <div className="form-group" style={{ maxWidth:280 }}>
          <label className="form-label">Старше чем (дней)</label>
          <input type="number" className="form-input" value={clearOpts.olderThanDays}
            onChange={e => setClearOpts(p => ({ ...p, olderThanDays: +e.target.value }))} min={0} />
          <div style={{ fontSize:11, color:'var(--text3)', marginTop:4 }}>0 = очистить все без ограничения по дате</div>
        </div>
        <div className="alert alert-warning" style={{ marginBottom:14 }}>
          <Shield size={15} />
          <span><strong>Внимание!</strong> Очищенные данные восстановить невозможно. Сначала сделайте выгрузку JSON.</span>
        </div>
        <button className="btn btn-danger" onClick={handleClear} disabled={clearing}>
          <Trash2 size={15} /> {clearing ? 'Очистка...' : 'Очистить выбранное'}
        </button>
      </div>

      {/* Full clear */}
      <div className="card" style={{ border:'1px solid var(--red,#ef4444)' }}>
        <h3 style={{ fontSize:15, fontWeight:700, marginBottom:6, display:'flex', alignItems:'center', gap:8, color:'var(--red)' }}>
          <AlertCircle size={17} /> Полная очистка всех данных
        </h3>
        <p style={{ color:'var(--text2)', fontSize:13, marginBottom:12 }}>
          Удаляет <strong>абсолютно все</strong> данные: товары, остатки, приходы, расходы, перемещения, аудит. Склады и пользователи сохраняются.
        </p>
        <div className="alert alert-danger" style={{ marginBottom:14 }}>
          <AlertTriangle size={15} />
          <div><strong>Опасная операция!</strong> Это действие необратимо. Требуется двойное подтверждение. Обязательно сделайте JSON-бэкап перед этим.</div>
        </div>
        <button className="btn btn-danger" onClick={handleClearAll} disabled={clearingAll}>
          <Trash2 size={15} /> {clearingAll ? 'Удаление...' : '🗑 Полностью очистить все данные'}
        </button>
      </div>
    </div>
  );
}
