import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';
import { useNavigate } from 'react-router-dom';
import { LogIn, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ login: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await login(form.login, form.password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)',
      backgroundImage: 'radial-gradient(ellipse 60% 50% at 50% -20%, rgba(0,212,170,0.07) 0%, transparent 60%)',
    }}>
      <div style={{ width: '100%', maxWidth: 360, padding: '0 20px' }}>

        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 52, height: 52,
            background: 'var(--accent)', borderRadius: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke="#0b0f1a" strokeWidth="2.5" strokeLinejoin="round"/>
              <path d="M9 22V12h6v10" stroke="#0b0f1a" strokeWidth="2.5" strokeLinejoin="round"/>
            </svg>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.3px' }}>
            Warhouse<span style={{ color: 'var(--accent)' }}>365</span>
          </div>
          <div style={{ color: 'var(--text3)', fontSize: 12, marginTop: 4 }}>
            Система складского учёта
          </div>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 18, color: 'var(--text2)' }}>
            Вход в систему
          </div>

          {error && (
            <div className="alert alert-danger" style={{ marginBottom: 14 }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Логин</label>
              <input
                className="form-input"
                value={form.login}
                onChange={e => setForm(p => ({ ...p, login: e.target.value }))}
                placeholder="Admin787"
                autoFocus
              />
            </div>
            <div className="form-group" style={{ position: 'relative' }}>
              <label className="form-label">Пароль</label>
              <input
                type={showPass ? 'text' : 'password'}
                className="form-input"
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                placeholder="••••••••"
                style={{ paddingRight: 38 }}
              />
              <button type="button" onClick={() => setShowPass(v => !v)}
                style={{
                  position: 'absolute', right: 10, top: 28,
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text3)', padding: 4, display: 'flex',
                }}>
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', marginTop: 6 }}
              disabled={loading}
            >
              <LogIn size={15} />
              {loading ? 'Входим...' : 'Войти'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 11, marginTop: 18 }}>
          Warhouse365 v2.0 • Складской учёт и касса
        </p>
      </div>
    </div>
  );
}
