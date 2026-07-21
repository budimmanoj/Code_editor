import React, { useState } from 'react';
import { api } from '../api/client';
import './AuthPage.css';

export default function AuthPage({ onLogin }) {
  const [tab, setTab] = useState('login');
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      let user;
      if (tab === 'register') {
        user = await api.register({ username: form.username, email: form.email, password: form.password });
      } else {
        user = await api.login(form.email, form.password);
      }
      onLogin(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-bg">
      <div className="auth-noise" />
      <div className="auth-glow" />

      <div className="auth-card">
        <div className="auth-logo">
          <span className="auth-logo-dot" />
          CodeRoom
        </div>

        <h1 className="auth-title">
          {tab === 'login' ? 'Welcome back' : 'Create account'}
        </h1>
        <p className="auth-sub">
          {tab === 'login'
            ? 'Sign in to your collaborative workspace'
            : 'Start coding with your team'}
        </p>

        <div className="auth-tabs">
          {['login', 'register'].map((t) => (
            <button
              key={t}
              className={`auth-tab ${tab === t ? 'active' : ''}`}
              onClick={() => { setTab(t); setError(''); }}
            >
              {t === 'login' ? 'Sign In' : 'Register'}
            </button>
          ))}
        </div>

        <form onSubmit={submit}>
          {tab === 'register' && (
            <div className="form-group">
              <label className="label">Username</label>
              <input className="input-field" placeholder="manoj_dev" value={form.username} onChange={set('username')} required />
            </div>
          )}
          <div className="form-group">
            <label className="label">Email</label>
            <input className="input-field" type="email" placeholder="you@example.com" value={form.email} onChange={set('email')} required />
          </div>
          <div className="form-group">
            <label className="label">Password</label>
            <input className="input-field" type="password" placeholder="••••••••" value={form.password} onChange={set('password')} required />
          </div>

          {error && <p className="auth-error">{error}</p>}

          <button className="btn-primary auth-submit" type="submit" disabled={loading}>
            {loading ? 'Loading...' : tab === 'login' ? 'Sign In →' : 'Create Account →'}
          </button>
        </form>

        <p className="auth-footer">
          Collaborative code editor · No WebSockets needed
        </p>
      </div>
    </div>
  );
}
