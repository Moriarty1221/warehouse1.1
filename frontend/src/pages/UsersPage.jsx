// ============================================================
// РАЗДЕЛ C: СТРАНИЦА УПРАВЛЕНИЯ ПОЛЬЗОВАТЕЛЯМИ
// Файл: frontend/src/pages/UsersPage.jsx
// Доступ: только admin
// ============================================================

import React, { useEffect, useState } from 'react';
import { Plus, Edit2, UserX } from 'lucide-react';
import { api } from '../utils/api';
import { useToast } from '../hooks/useToast.jsx';

// --- C.1: Конфигурация ролей (метки, описания, цвета) ---
const ROLE_CONFIG = {
  admin: {
    label: '👑 Администратор',
    description: 'Полный доступ ко всей системе',
    badge: 'badge-purple',
  },
  manager: {
    label: '📋 Менеджер',
    description: 'Склад, отчёты, смены, касса, инвентаризация',
    badge: 'badge-blue',
  },
  cashier: {
    label: '💳 Кассир',
    description: 'Только касса, смены и возвраты',
    badge: 'badge-green',
  },
  collector: {
    label: '🏦 Инкассатор',
    description: 'Просмотр смен, Z-отчёт, история продаж',
    badge: 'badge-yellow',
  },
  inventor: {
    label: '📦 Инвентор',
    description: 'Инвентаризация, просмотр товаров и остатков',
    badge: 'badge-gray',
  },
};

// --- C.2: Модальное окно создания/редактирования ---
function UserModal({ user, warehouses, onSave, onClose }) {
  const [form, setForm] = useState(
    user || { login: '', password: '', fullName: '', role: 'cashier', warehouseId: '', isActive: true }
  );
  const [loading, setLoading] = useState(false);
  const { show } = useToast();

  const handleSave = async () => {
    setLoading(true);
    try {
      if (user?.id) {
        await api(`/users/${user.id}`, { method: 'PUT', body: JSON.stringify(form) });
      } else {
        await api('/users', { method: 'POST', body: JSON.stringify(form) });
      }
      show('Сохранено', 'success');
      onSave();
    } catch (err) {
      show(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const selectedRole = ROLE_CONFIG[form.role];

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">
            {user?.id ? 'Редактировать пользователя' : 'Новый пользователь'}
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* C.2.1: Логин и пароль */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Логин *</label>
              <input
                className="form-input"
                value={form.login}
                onChange={e => setForm(p => ({ ...p, login: e.target.value }))}
                disabled={!!user?.id}
              />
            </div>
            <div className="form-group">
              <label className="form-label">{user?.id ? 'Новый пароль' : 'Пароль *'}</label>
              <input
                type="password"
                className="form-input"
                value={form.password || ''}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                placeholder={user?.id ? 'Оставьте пустым' : ''}
              />
            </div>
          </div>

          {/* C.2.2: Полное имя */}
          <div className="form-group">
            <label className="form-label">Полное имя *</label>
            <input
              className="form-input"
              value={form.fullName}
              onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))}
            />
          </div>

          {/* C.2.3: Роль с описанием */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Роль</label>
              <select
                className="form-select"
                value={form.role}
                onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
              >
                {Object.entries(ROLE_CONFIG).map(([key, cfg]) => (
                  <option key={key} value={key}>{cfg.label}</option>
                ))}
              </select>
              {selectedRole && (
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                  {selectedRole.description}
                </div>
              )}
            </div>

            {/* C.2.4: Привязка к складу */}
            <div className="form-group">
              <label className="form-label">Склад</label>
              <select
                className="form-select"
                value={form.warehouseId || ''}
                onChange={e => setForm(p => ({ ...p, warehouseId: e.target.value }))}
              >
                <option value="">Все склады</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* C.2.5: Статус активности (только при редактировании) */}
          {user?.id && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))}
                style={{ accentColor: 'var(--accent)' }}
              />
              Активен
            </label>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Отмена</button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={loading || !form.login || !form.fullName || (!user?.id && !form.password)}
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}

// --- C.3: Основная страница ---
export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(true);
  const { show } = useToast();

  useEffect(() => {
    document.getElementById('page-title').textContent = 'Пользователи';
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    const [u, w] = await Promise.all([api('/users'), api('/warehouses')]);
    setUsers(u);
    setWarehouses(w);
    setLoading(false);
  };

  const deactivate = async (id) => {
    if (!confirm('Деактивировать пользователя?')) return;
    try {
      await api(`/users/${id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      show(err.message, 'error');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
        <button className="btn btn-primary" onClick={() => setModal({})}>
          <Plus size={15} /> Добавить
        </button>
      </div>

      {loading ? (
        <div className="loader"><div className="spinner" /></div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Логин</th>
                <th>Имя</th>
                <th>Роль</th>
                <th>Доступ</th>
                <th>Склад</th>
                <th>Статус</th>
                <th>Создан</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const roleCfg = ROLE_CONFIG[u.role] || { label: u.role, description: '', badge: 'badge-gray' };
                return (
                  <tr key={u.id}>
                    <td><span className="mono">{u.login}</span></td>
                    <td><strong>{u.fullName}</strong></td>
                    <td>{roleCfg.label}</td>
                    <td>
                      <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                        {roleCfg.description}
                      </span>
                    </td>
                    <td>
                      {u.warehouse?.name || (
                        <span style={{ color: 'var(--text3)' }}>Все</span>
                      )}
                    </td>
                    <td>
                      {u.isActive
                        ? <span className="badge badge-green">Активен</span>
                        : <span className="badge badge-gray">Неактивен</span>
                      }
                    </td>
                    <td style={{ color: 'var(--text3)', fontSize: 12 }}>
                      {new Date(u.createdAt).toLocaleDateString('ru-RU')}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-ghost btn-sm btn-icon"
                          onClick={() => setModal(u)}
                        >
                          <Edit2 size={14} />
                        </button>
                        {u.login !== 'Admin787' && (
                          <button
                            className="btn btn-danger btn-sm btn-icon"
                            onClick={() => deactivate(u.id)}
                          >
                            <UserX size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal !== null && (
        <UserModal
          user={modal?.id ? modal : null}
          warehouses={warehouses}
          onSave={() => { setModal(null); load(); }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
