import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { Icon, HandArrow, Wordmark } from './components/shared';

// Field component for consistency
const Field = ({ label, type = 'text', placeholder, value, onChange, disabled }) => {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="mono" style={{ fontSize: 12, color: 'var(--mut)', letterSpacing: '.16em', textTransform: 'uppercase' }}>
        {label}
      </span>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        disabled={disabled}
        style={{
          padding: '15px 18px', borderRadius: 12,
          border: '1px solid var(--line-strong)',
          background: 'var(--card)', color: 'var(--fg)',
          fontFamily: 'Geist, sans-serif', fontSize: 16, outline: 'none'
        }}
      />
    </label>
  );
};

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    if (!email.trim()) {
      setError('Email is required');
      setLoading(false);
      return;
    }

    try {
      // Use production URL for consistency
      const baseUrl = process.env.NODE_ENV === 'production' 
        ? 'https://deepresearchbeta.vercel.app'
        : window.location.origin;
        
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${baseUrl}/reset-password`,
      });
      
      if (error) throw error;
      
      setMessage('Check your email for a password reset link!');
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Custom TopNav for forgot password page
  const ForgotPasswordTopNav = () => {
    const links = [
      { id: 'welcome', label: 'Home' },
      { id: 'auth', label: 'Sign In' }
    ];

    const go = (route) => {
      if (route === 'welcome') {
        navigate('/');
      } else if (route === 'auth') {
        navigate('/login');
      }
    };

    return (
      <header className="auth-top-nav" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 36px', borderBottom: '1px solid var(--line)',
        position: 'sticky', top: 0, zIndex: 50,
        background: 'color-mix(in srgb, var(--bg) 88%, transparent)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)'
      }}>
        <div onClick={() => go('welcome')} style={{ cursor: 'pointer' }}>
          <Wordmark />
        </div>

        <nav style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
          {links.map((l) =>
            <button key={l.id} onClick={() => go(l.id)} className="mono"
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--mut)',
                fontSize: 16, padding: '15px 24px', borderRadius: 8,
                fontFamily: 'JetBrains Mono, monospace',
                letterSpacing: '.02em',
                position: 'relative'
              }}>
              {l.label}
            </button>
          )}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: '120px' }}></div>
        </div>
      </header>
    );
  };

  return (
    <div className="route dot-paper" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <ForgotPasswordTopNav />
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
        {/* LEFT — editorial poster */}
        <div className="auth-left-panel" style={{
          padding: '40px 70px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          borderRight: '1px solid var(--line)', position: 'relative', overflow: 'hidden'
        }}>
          <div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
              <span className="sticker"><span className="dot-2" /> password reset</span>
            </div>
            <h2 className="serif" style={{
              fontSize: 'clamp(60px, 7.5vw, 110px)', lineHeight: .95, letterSpacing: '-.025em',
              margin: '30px 0 0'
            }}>
              Forgot your <span style={{ fontStyle: 'italic' }} className="squiggle">password</span>?<br />
              No worries.
            </h2>
            <p className="auth-welcome-text" style={{ marginTop: 28, maxWidth: 525, fontSize: 20, lineHeight: 1.55, color: 'var(--mut)' }}>
              Enter your email address and we'll send you a secure link to reset your password and get back to your research.
            </p>
          </div>

          {/* decorative annotated card */}
          <div className="auth-decorative-card" style={{ position: 'relative', marginTop: 50 }}>
            <div className="card" style={{
              padding: 22, transform: 'rotate(-2deg)', maxWidth: 475,
              background: 'var(--paper)'
            }}>
              <div className="mono" style={{ fontSize: 12, color: 'var(--mut2)', letterSpacing: '.18em' }}>SECURITY NOTE</div>
              <div className="serif" style={{ fontSize: 30, lineHeight: 1.15, marginTop: 8, letterSpacing: '-.01em' }}>
                "A forgotten password is just a <span className="marker">stepping stone</span> to security."
              </div>
              <div className="mono" style={{ marginTop: 15, fontSize: 14, color: 'var(--mut)' }}>— security best practices</div>
            </div>
            <div style={{ position: 'absolute', right: 65, top: -10 }}>
              <HandArrow rotate={150} color="var(--cyan)" />
            </div>
          </div>
        </div>

        {/* RIGHT — form */}
        <div className="auth-right-panel" style={{ padding: '40px 70px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: 475 }}>
            <h3 className="serif" style={{ fontSize: 45, lineHeight: 1.1, margin: 0, letterSpacing: '-.015em' }}>
              Reset your <span style={{ fontStyle: 'italic' }}>password</span>.
            </h3>

            {/* Error Messages */}
            {error && (
              <div style={{ 
                marginTop: 20, padding: '12px 16px', borderRadius: 8,
                background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)',
                color: '#dc2626'
              }}>
                <p className="mono" style={{ fontSize: 12, margin: 0 }}>{error}</p>
              </div>
            )}

            {/* Success Messages */}
            {message && (
              <div style={{ 
                marginTop: 20, padding: '12px 16px', borderRadius: 8,
                background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.2)',
                color: '#16a34a'
              }}>
                <p className="mono" style={{ fontSize: 12, margin: 0 }}>{message}</p>
              </div>
            )}

            <form onSubmit={handleSubmit}
            style={{ marginTop: 26, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field 
                label="Email Address" 
                type="email" 
                placeholder="example.email.com" 
                value={email} 
                onChange={setEmail}
                disabled={loading}
              />

              <button 
                type="submit" 
                className="btn btn-primary" 
                disabled={loading}
                style={{ 
                  marginTop: 10, justifyContent: 'center', padding: '18px 22px', 
                  backgroundColor: "rgb(242, 129, 29)",
                  opacity: loading ? 0.6 : 1,
                  fontSize: '16px'
                }}
              >
                {loading ? (
                  <>
                    <div style={{ 
                      width: 16, height: 16, border: '2px solid white', borderTop: '2px solid transparent', 
                      borderRadius: '50%', animation: 'spin 1s linear infinite', marginRight: 8
                    }} />
                    Sending Reset Link...
                  </>
                ) : (
                  <>
                    Send Reset Link <Icon.Arrow />
                  </>
                )}
              </button>
            </form>

            <div style={{ marginTop: 20, textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => navigate('/login')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--mut)',
                  fontSize: '12px',
                  fontFamily: 'JetBrains Mono, monospace',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  letterSpacing: '.02em'
                }}
              >
                ← Back to sign in
              </button>
            </div>

            <p className="mono" style={{ marginTop: 28, fontSize: 13, color: 'var(--mut2)', letterSpacing: '.02em', textAlign: 'center' }}>
              by continuing you agree to our terms · privacy
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;