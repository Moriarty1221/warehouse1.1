// ============================================================
// РАЗДЕЛ D: КНОПКА ОТПРАВКИ ОТЧЁТА В TELEGRAM
// Файл: frontend/src/components/TelegramReportButton.jsx
// ============================================================
// Универсальный компонент — вставляется на любую страницу.
// Автоматически определяет тип отчёта по роли пользователя.
// Использование: <TelegramReportButton />
// ============================================================

import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { api } from '../utils/api';
import { useAuth } from '../hooks/useAuth.jsx';
import { useToast } from '../hooks/useToast.jsx';

// --- D.1: Конфигурация отчёта для каждой роли ---
const REPORT_CONFIG = {
  admin: {
    title: 'Сводный отчёт (Администратор)',
    description: 'Продажи, остатки, смены, движение товара за сегодня',
    endpoint: '/reports/telegram/admin',
    color: '#7c3aed',
  },
  manager: {
    title: 'Отчёт менеджера',
    description: 'Продажи, приходы/расходы, остатки за сегодня',
    endpoint: '/reports/telegram/manager',
    color: '#2563eb',
  },
  cashier: {
    title: 'Отчёт кассира',
    description: 'Продажи за смену: чеки, суммы, способы оплаты',
    endpoint: '/reports/telegram/cashier',
    color: '#16a34a',
  },
  collector: {
    title: 'Отчёт инкассатора',
    description: 'Сводка по сменам и инкассациям за сегодня',
    endpoint: '/reports/telegram/collector',
    color: '#d97706',
  },
  inventor: {
    title: 'Отчёт инвентора',
    description: 'Сводка по инвентаризациям и расхождениям',
    endpoint: '/reports/telegram/inventor',
    color: '#0891b2',
  },
};

// --- D.2: Компонент кнопки ---
export default function TelegramReportButton({ style = {} }) {
  const { user } = useAuth();
  const { show } = useToast();
  const [loading, setLoading] = useState(false);

  const config = REPORT_CONFIG[user?.role];
  if (!config) return null;

  const handleSend = async () => {
    setLoading(true);
    try {
      await api(config.endpoint, {
        method: 'POST',
        body: JSON.stringify({ warehouseId: user?.warehouseId || null }),
      });
      show('✅ Отчёт отправлен в Telegram!', 'success');
    } catch (err) {
      show('Ошибка: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="card"
      style={{
        marginBottom: 20,
        background: `${config.color}14`,
        border: `1px solid ${config.color}44`,
        ...style,
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <h3 style={{
            fontSize: 14, fontWeight: 700, marginBottom: 3,
            display: 'flex', alignItems: 'center', gap: 7,
          }}>
            <Send size={15} style={{ color: config.color }} />
            {config.title}
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>
            {config.description} · <strong>@{user?.login}</strong>
          </p>
        </div>
        <button
          className="btn"
          onClick={handleSend}
          disabled={loading}
          style={{
            background: config.color,
            color: '#fff',
            minWidth: 170,
            fontWeight: 600,
            fontSize: 13,
            display: 'flex', alignItems: 'center', gap: 7,
          }}
        >
          {loading
            ? '⏳ Отправка...'
            : <><Send size={14} /> Отправить в Telegram</>
          }
        </button>
      </div>
    </div>
  );
}
