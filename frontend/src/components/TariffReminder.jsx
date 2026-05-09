import React, { useState, useEffect } from 'react';
import { X, CreditCard, AlertTriangle } from 'lucide-react';

export default function TariffReminder() {
  const [dismissed, setDismissed] = useState(false);

  // Show only in last 5 days of the month
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = lastDay - now.getDate();
  const shouldShow = daysLeft <= 4; // last 5 days (0-4 days left)

  // Persist dismissal per month
  useEffect(() => {
    const key = `tariff_dismissed_${now.getFullYear()}_${now.getMonth()}`;
    if (localStorage.getItem(key)) setDismissed(true);
  }, []);

  const handleDismiss = () => {
    const key = `tariff_dismissed_${now.getFullYear()}_${now.getMonth()}`;
    localStorage.setItem(key, '1');
    setDismissed(true);
  };

  if (!shouldShow || dismissed) return null;

  const isUrgent = daysLeft <= 1;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
      background: isUrgent ? 'var(--red)' : '#f59e0b',
      color: 'white', padding: '10px 20px',
      display: 'flex', alignItems: 'center', gap: 12,
      fontSize: 13, fontWeight: 500,
      boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
    }}>
      <CreditCard size={18} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <strong>
          {isUrgent
            ? '🚨 Сегодня последний день месяца!'
            : `⏰ До конца месяца осталось ${daysLeft + 1} дня`}
        </strong>
        {' '}— Не забудьте продлить тарифный план СкладПро для бесперебойной работы системы.
      </div>
      <button
        onClick={handleDismiss}
        style={{ background: 'rgba(255,255,255,0.25)', border: 'none', color: 'white', padding: '4px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}
      >
        Напомнить позже <X size={13} />
      </button>
    </div>
  );
}
