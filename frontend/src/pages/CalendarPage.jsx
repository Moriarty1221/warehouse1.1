import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Package, ArrowDownCircle, ArrowUpCircle, ShoppingCart } from 'lucide-react';
import { api } from '../utils/api';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  // Monday = 0
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1;
}

export default function CalendarPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [events, setEvents] = useState({});
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    document.getElementById('page-title').textContent = 'Календарь';
    loadEvents();
  }, [year, month]);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const [receipts, issues] = await Promise.all([
        api('/receipts'),
        api('/issues')
      ]);

      const map = {};
      const addEvent = (date, event) => {
        const key = new Date(date).toISOString().slice(0, 10);
        if (!map[key]) map[key] = [];
        map[key].push(event);
      };

      for (const r of receipts) {
        const d = new Date(r.date);
        if (d.getFullYear() === year && d.getMonth() === month) {
          const total = r.items?.reduce((s, i) => s + i.quantity * i.costPerUnit, 0) || 0;
          addEvent(r.date, {
            type: 'receipt',
            label: `📦 Приход: ${r.items?.length || 0} поз.`,
            detail: `Поставщик: ${r.supplier?.name || 'н/у'} | Сумма: ${total.toLocaleString('ru-RU')} сом`,
            color: '#22c55e',
            icon: 'receipt',
            data: r
          });
        }
      }

      for (const i of issues) {
        const d = new Date(i.date);
        if (d.getFullYear() === year && d.getMonth() === month) {
          const isPos = i.notes && i.notes.includes('POS');
          const total = i.items?.reduce((s, item) => s + item.quantity * (item.product?.price || 0), 0) || 0;
          addEvent(i.date, {
            type: isPos ? 'pos' : 'issue',
            label: isPos ? `🧾 Продажа: ${i.items?.length || 0} поз.` : `📤 Расход: ${i.items?.length || 0} поз.`,
            detail: isPos
              ? `Кассир: ${i.recipient || '—'} | ${total.toLocaleString('ru-RU')} сом`
              : `Получатель: ${i.recipient || '—'}`,
            color: isPos ? '#8b5cf6' : '#f59e0b',
            icon: isPos ? 'pos' : 'issue',
            data: i
          });
        }
      }

      setEvents(map);
    } catch {}
    setLoading(false);
  };

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
    setSelected(null);
  };

  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
    setSelected(null);
  };

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const todayKey = now.toISOString().slice(0, 10);

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const selectedKey = selected
    ? `${year}-${String(month + 1).padStart(2, '0')}-${String(selected).padStart(2, '0')}`
    : null;

  const selectedEvents = selectedKey ? (events[selectedKey] || []) : [];

  // Summary counts for the month
  const monthReceipts = Object.values(events).flat().filter(e => e.type === 'receipt').length;
  const monthPos = Object.values(events).flat().filter(e => e.type === 'pos').length;
  const monthIssues = Object.values(events).flat().filter(e => e.type === 'issue').length;

  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      {/* Calendar */}
      <div className="card" style={{ flex: '1 1 500px', padding: 0, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <button className="btn btn-ghost btn-icon" onClick={prevMonth}><ChevronLeft size={18} /></button>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, textAlign: 'center' }}>
              {MONTHS[month]} {year}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', marginTop: 2 }}>
              {loading ? 'Загрузка...' : `📦 ${monthReceipts} приходов · 🧾 ${monthPos} продаж · 📤 ${monthIssues} расходов`}
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={nextMonth}><ChevronRight size={18} /></button>
        </div>

        {/* Weekdays */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border)' }}>
          {WEEKDAYS.map(d => (
            <div key={d} style={{ padding: '8px 0', textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text3)' }}>{d}</div>
          ))}
        </div>

        {/* Days grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {cells.map((day, idx) => {
            if (!day) return <div key={`e-${idx}`} style={{ minHeight: 72, borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: 'var(--bg3)' }} />;

            const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayEvents = events[key] || [];
            const isToday = key === todayKey;
            const isSelected = day === selected;

            return (
              <div
                key={day}
                onClick={() => setSelected(day === selected ? null : day)}
                style={{
                  minHeight: 72, padding: '6px 8px', cursor: 'pointer',
                  borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
                  background: isSelected ? 'var(--accent-glow)' : isToday ? 'rgba(139,92,246,0.05)' : 'var(--bg)',
                  borderLeft: isSelected ? '2px solid var(--accent)' : undefined,
                  transition: 'background 0.1s'
                }}
              >
                <div style={{
                  fontSize: 13, fontWeight: isToday ? 700 : 400,
                  color: isToday ? 'var(--accent)' : 'var(--text)',
                  width: 24, height: 24,
                  borderRadius: isToday ? '50%' : 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isToday ? 'var(--accent)' : 'transparent',
                  color: isToday ? 'white' : 'var(--text)'
                }}>
                  {day}
                </div>
                <div style={{ marginTop: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {dayEvents.slice(0, 3).map((ev, i) => (
                    <div key={i} style={{
                      fontSize: 10, padding: '1px 4px', borderRadius: 3,
                      background: ev.color + '22', color: ev.color,
                      fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                    }}>
                      {ev.label}
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div style={{ fontSize: 10, color: 'var(--text3)' }}>+{dayEvents.length - 3} ещё</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail panel */}
      <div style={{ width: 280, flexShrink: 0 }}>
        {selected ? (
          <div className="card">
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>
              {selected} {MONTHS[month]} {year}
            </div>
            {selectedEvents.length === 0 ? (
              <div style={{ color: 'var(--text3)', fontSize: 13, textAlign: 'center', padding: 20 }}>
                Нет событий
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {selectedEvents.map((ev, i) => (
                  <div key={i} style={{ background: 'var(--bg2)', borderRadius: 8, padding: '10px 12px', borderLeft: `3px solid ${ev.color}` }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: ev.color }}>{ev.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>{ev.detail}</div>
                    {ev.data?.notes && ev.type !== 'pos' && (
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>💬 {ev.data.notes}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="card" style={{ textAlign: 'center', color: 'var(--text3)' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📅</div>
            <div style={{ fontSize: 13 }}>Выберите день для просмотра событий</div>
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                <span style={{ width: 12, height: 12, borderRadius: 2, background: '#22c55e', flexShrink: 0 }} />
                <span style={{ color: 'var(--text2)' }}>Приход товара</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                <span style={{ width: 12, height: 12, borderRadius: 2, background: '#8b5cf6', flexShrink: 0 }} />
                <span style={{ color: 'var(--text2)' }}>Продажа (Касса)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                <span style={{ width: 12, height: 12, borderRadius: 2, background: '#f59e0b', flexShrink: 0 }} />
                <span style={{ color: 'var(--text2)' }}>Расход товара</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
