import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Zap, ShieldCheck, Users, Code2 } from 'lucide-react';
import './AuthPage.css';

export default function AuthPage({ onLogin }) {
  const [view, setView] = useState('login'); 
  // views: login, register, verify-otp, forgot-password, forgot-verify-otp, reset-password
  
  const [form, setForm] = useState({ 
    username: '', email: '', password: '', confirmPassword: '', otp: '', newPassword: '' 
  });
  
  const [resetToken, setResetToken] = useState(null);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const switchView = (newView) => {
    setView(newView);
    setError('');
    setSuccess('');
    setForm(f => ({ ...f, otp: '', password: '', confirmPassword: '', newPassword: '' }));
  };

  const startCountdown = () => setCountdown(30);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (view === 'login') {
        const user = await api.login(form.email, form.password);
        onLogin(user);
      } 
      else if (view === 'register') {
        if (form.password !== form.confirmPassword) throw new Error("Passwords do not match");
        const res = await api.register({
          username: form.username,
          email: form.email,
          password: form.password,
          confirmPassword: form.confirmPassword
        });
        setSuccess(res.message || "OTP sent to your email");
        startCountdown();
        switchView('verify-otp');
      }
      else if (view === 'verify-otp') {
        const user = await api.verifyRegistration({ email: form.email, otp: form.otp });
        onLogin(user);
      }
      else if (view === 'forgot-password') {
        const res = await api.forgotPassword(form.email);
        setSuccess(res.message);
        startCountdown();
        switchView('forgot-verify-otp');
      }
      else if (view === 'forgot-verify-otp') {
        const res = await api.verifyForgotPasswordOtp({ email: form.email, otp: form.otp });
        setResetToken(res.token);
        switchView('reset-password');
      }
      else if (view === 'reset-password') {
        if (form.newPassword !== form.confirmPassword) throw new Error("Passwords do not match");
        const res = await api.resetPassword(resetToken, {
          newPassword: form.newPassword,
          confirmPassword: form.confirmPassword
        });
        setSuccess(res.message || "Password reset successfully. You can now log in.");
        switchView('login');
      }
    } catch (err) {
      if (view === 'login' && err.message.toLowerCase().includes("not found")) {
        setError("You are a new account, so register first!");
        setTimeout(() => switchView('register'), 1500);
      } else if (view === 'register' && err.message.toLowerCase().includes("already")) {
        setError("You are already a user, go for login!");
        setTimeout(() => switchView('login'), 1500);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (countdown > 0) return;
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      if (view === 'verify-otp') {
        const res = await api.resendRegistrationOtp(form.email);
        setSuccess(res.message);
      } else if (view === 'forgot-verify-otp') {
        await api.forgotPassword(form.email); // re-initiate
        setSuccess("New OTP sent to your email");
      }
      startCountdown();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderPasswordRequirements = (pwd) => {
    const hasLen = pwd.length >= 8;
    const hasUpper = /[A-Z]/.test(pwd);
    const hasNum = /[0-9]/.test(pwd);
    const hasSpec = /[^a-zA-Z0-9]/.test(pwd);
    
    return (
      <div className="pwd-requirements">
        <div className={hasLen ? 'valid' : 'invalid'}>{hasLen ? '✓' : '○'} At least 8 characters</div>
        <div className={hasUpper ? 'valid' : 'invalid'}>{hasUpper ? '✓' : '○'} At least one uppercase letter</div>
        <div className={hasNum ? 'valid' : 'invalid'}>{hasNum ? '✓' : '○'} At least one number</div>
        <div className={hasSpec ? 'valid' : 'invalid'}>{hasSpec ? '✓' : '○'} At least one special character</div>
      </div>
    );
  };

  return (
    <div className="auth-bg">
      <div className="auth-watermark">
        <span style={{ color: '#a7f3d0' }}>CODE</span>
        <span style={{ color: '#065f46' }}>ROOM</span>
      </div>

      {/* ── Hero Section (Top Fold) ── */}
      <div className="auth-hero">
        <div className="auth-noise" />
        <div className="auth-glow" />
        <div className="scroll-indicator"><span>&#x2193;</span></div>

      <div className="auth-card">
        <div className="auth-logo">
          <span className="auth-logo-dot" />
          CodeRoom
        </div>

        <h1 className="auth-title">
          {view === 'login' && 'Welcome back'}
          {view === 'register' && 'Create account'}
          {view === 'verify-otp' && 'Verify your email'}
          {view === 'forgot-password' && 'Reset password'}
          {view === 'forgot-verify-otp' && 'Verify OTP'}
          {view === 'reset-password' && 'Set new password'}
        </h1>
        
        <p className="auth-sub">
          {view === 'login' && 'Sign in to your collaborative workspace'}
          {view === 'register' && 'Start coding with your team'}
          {(view === 'verify-otp' || view === 'forgot-verify-otp') && `Enter the 6-digit code sent to ${form.email}`}
          {view === 'reset-password' && 'Create a strong, secure password'}
        </p>

        {(view === 'login' || view === 'register') && (
          <div className="auth-tabs">
            <button
              className={`auth-tab ${view === 'login' ? 'active' : ''}`}
              onClick={() => switchView('login')}
            >
              Sign In
            </button>
            <button
              className={`auth-tab ${view === 'register' ? 'active' : ''}`}
              onClick={() => switchView('register')}
            >
              Register
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          
          {(view === 'login' || view === 'register' || view === 'forgot-password') && (
            <div className="form-group">
              <label className="label">Email</label>
              <input className="input-field" type="email" placeholder="you@example.com" value={form.email} onChange={set('email')} required />
            </div>
          )}

          {view === 'register' && (
            <div className="form-group">
              <label className="label">Username</label>
              <input className="input-field" placeholder="manoj_dev" value={form.username} onChange={set('username')} required />
            </div>
          )}

          {(view === 'login' || view === 'register') && (
            <div className="form-group">
              <div style={{display: 'flex', justifyContent: 'space-between'}}>
                <label className="label">Password</label>
                {view === 'login' && (
                  <button type="button" className="inline-link" onClick={() => switchView('forgot-password')}>
                    Forgot password?
                  </button>
                )}
              </div>
              <input className="input-field" type="password" placeholder="••••••••" value={form.password} onChange={set('password')} required />
              
              {view === 'register' && form.password.length > 0 && renderPasswordRequirements(form.password)}
            </div>
          )}

          {view === 'register' && (
            <div className="form-group">
              <label className="label">Confirm Password</label>
              <input className="input-field" type="password" placeholder="••••••••" value={form.confirmPassword} onChange={set('confirmPassword')} required />
            </div>
          )}

          {(view === 'verify-otp' || view === 'forgot-verify-otp') && (
            <div className="form-group">
              <label className="label">6-Digit OTP</label>
              <input className="input-field" type="text" maxLength={6} placeholder="123456" value={form.otp} onChange={set('otp')} required />
            </div>
          )}

          {view === 'reset-password' && (
            <>
              <div className="form-group">
                <label className="label">New Password</label>
                <input className="input-field" type="password" placeholder="••••••••" value={form.newPassword} onChange={set('newPassword')} required />
                {form.newPassword.length > 0 && renderPasswordRequirements(form.newPassword)}
              </div>
              <div className="form-group">
                <label className="label">Confirm New Password</label>
                <input className="input-field" type="password" placeholder="••••••••" value={form.confirmPassword} onChange={set('confirmPassword')} required />
              </div>
            </>
          )}

          {error && <p className="auth-error">{error}</p>}
          {success && <p className="auth-success" style={{color: 'var(--accent-green)', fontSize: '13px', marginTop: '12px'}}>{success}</p>}

          <button className="btn-primary auth-submit" type="submit" disabled={loading}>
            {loading ? 'Loading...' : (
              view === 'login' ? 'Sign In →' : 
              view === 'register' ? 'Create Account →' :
              (view === 'verify-otp' || view === 'forgot-verify-otp') ? 'Verify OTP' :
              view === 'forgot-password' ? 'Send OTP' :
              'Reset Password'
            )}
          </button>
        </form>

        {(view === 'verify-otp' || view === 'forgot-verify-otp') && (
          <div className="resend-container" style={{marginTop: '16px', textAlign: 'center'}}>
            <button 
              type="button" 
              className="inline-link" 
              disabled={countdown > 0 || loading}
              onClick={handleResendOtp}
            >
              {countdown > 0 ? `Resend OTP in ${countdown}s` : 'Resend OTP'}
            </button>
          </div>
        )}

        {(view === 'forgot-password' || view === 'forgot-verify-otp' || view === 'reset-password') && (
          <div style={{marginTop: '16px', textAlign: 'center'}}>
            <button type="button" className="inline-link" onClick={() => switchView('login')}>
              Back to Login
            </button>
          </div>
        )}

        {view === 'login' && (
          <div style={{marginTop: '16px', textAlign: 'center', fontSize: '14px', color: 'var(--text-secondary)'}}>
            New user?{' '}
            <button type="button" className="inline-link" onClick={() => switchView('register')}>
              Create an account
            </button>
          </div>
        )}

        {view === 'register' && (
          <div style={{marginTop: '16px', textAlign: 'center', fontSize: '14px', color: 'var(--text-secondary)'}}>
            Already have an account?{' '}
            <button type="button" className="inline-link" onClick={() => switchView('login')}>
              Sign in
            </button>
          </div>
        )}

        <p className="auth-footer">
          Collaborative code editor · Secure Authentication
        </p>
      </div>
      </div>

      {/* ── Landing Page Features ── */}
      <section className="landing-features">
        <div className="features-container">
          <div className="features-header">
            <h2>Built for modern engineering teams</h2>
            <p>CodeRoom combines the familiarity of a powerful IDE with the real-time speed of multiplayer collaboration, letting your team ship faster together.</p>
          </div>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon"><Zap size={24} /></div>
              <h3>Zero-Latency Sync</h3>
              <p>Experience true real-time collaboration. Cursors, selections, and code changes sync instantly across your entire team using WebSockets and CRDTs.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon"><Users size={24} /></div>
              <h3>Multiplayer Pairing</h3>
              <p>Work together in the same workspace seamlessly. Perfect for pair programming, live code reviews, and remote technical interviews.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon"><Code2 size={24} /></div>
              <h3>Intelligent AI Panel</h3>
              <p>Leverage the power of integrated AI to instantly review code, generate tests, explain complex logic, and debug errors without leaving the editor.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon"><ShieldCheck size={24} /></div>
              <h3>Enterprise Security</h3>
              <p>Your code is protected by end-to-end encryption, robust authentication flows, and role-based workspace authorization models.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Landing Page Footer ── */}
      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-logo">
            <span className="auth-logo-dot" />
            CodeRoom
          </div>
          <div className="footer-text">
            Experience real-time collaborative coding with zero friction.
            <br />Built for high-performance teams and seamless pair programming.
          </div>
          <div className="footer-contact">
            National Institute of Technology (NIT), Tiruchirappalli<br />
            For any queries contact: <a href="mailto:coderoomhost@gmail.com">coderoomhost@gmail.com</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
