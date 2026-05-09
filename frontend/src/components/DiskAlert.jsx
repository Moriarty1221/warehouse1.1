import React, { useState, useEffect } from 'react';
import { AlertTriangle, X, Download, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function DiskAlert() {
  const [usage, setUsage] = useState(window.__diskUsage || 0);
  const [dismissed, setDismissed] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e) => { setUsage(e.detail.usage); setDismissed(false); };
    window.addEventListener('diskUsageUpdate', handler);
    return () => window.removeEventListener('diskUsageUpdate', handler);
  }, []);

  if (dismissed || usage < 90) return null;

  const isCritical = usage >= 90;
  const isWarning = usage >= 90 && usage < 95;

  return (
    <div className={`disk-alert-banner ${isWarning && !isCritical ? 'warning' : ''}`}>
      <AlertTriangle size={18} />
      <div style={{ flex: 1 }}>
        <strong>
          {isCritical ? '🚨 Диск заполнен на ' : '⚠️ Диск заполнен на '}{usage}%
        </strong>
        {isCritical
          ? ' — запись заблокирована при 95%. Выгрузите данные и очистите сервер!'
          : ' — рекомендуется выгрузить данные и освободить место.'}
      </div>
      <button
        onClick={() => navigate('/system')}
        style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', padding: '5px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}
      >
        <Download size={14} /> Выгрузить и очистить
      </button>
      {isWarning && (
        <button onClick={() => setDismissed(true)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', padding: 4 }}>
          <X size={16} />
        </button>
      )}
    </div>
  );
}
