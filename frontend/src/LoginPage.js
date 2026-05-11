import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { config, BETA_SIGNUP_FULL_MESSAGE } from './config';
import { Icon, HandArrow, Wordmark } from './components/shared';

// Field component moved outside to prevent re-creation on each render
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

function betaSpotsStickerLabel(betaSignupStatus, seats) {
  if (betaSignupStatus === 'loading') return 'spots · …';
  if (betaSignupStatus === 'error') return '50 seat cap';
  const lim = typeof seats.limit === 'number' && seats.limit > 0 ? seats.limit : 50;
  if (
    seats.degraded ||
    seats.spotsRemaining == null ||
    typeof seats.signupOpen !== 'boolean'
  ) {
    return `${lim} seat cap`;
  }
  if (!seats.signupOpen) {
    return `full · ${lim} spots`;
  }
  return `${seats.spotsRemaining} / ${lim} left`;
}

function betaSpotsStickerDotColor(betaSignupStatus, seats) {
  const yellow = '#ffd23f';
  const green = '#22c55e';
  const red = '#ef4345';

  if (betaSignupStatus === 'loading') return yellow;
  if (betaSignupStatus === 'error') return yellow;

  const lim = typeof seats.limit === 'number' && seats.limit > 0 ? seats.limit : null;
  const spots = typeof seats.spotsRemaining === 'number' ? seats.spotsRemaining : null;

  if (
    seats.degraded ||
    lim == null ||
    spots == null ||
    typeof seats.signupOpen !== 'boolean'
  ) {
    return yellow;
  }

  if (!seats.signupOpen || spots <= 15) return red;

  const registered = lim - spots;
  if (registered >= 30) return yellow;

  return green;
}

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [betaSignupStatus, setBetaSignupStatus] = useState('loading'); // loading | open | full | error
  const [betaSeats, setBetaSeats] = useState({
    signupOpen: null,
    spotsRemaining: null,
    limit: null,
    degraded: false,
  });
  const { signUp, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(config.endpoints.betaSignupStatus);
        if (!res.ok) {
          if (!cancelled) setBetaSignupStatus('error');
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setBetaSignupStatus(data.signup_open ? 'open' : 'full');
          setBetaSeats({
            signupOpen: typeof data.signup_open === 'boolean' ? data.signup_open : null,
            spotsRemaining:
              typeof data.spots_remaining === 'number' ? data.spots_remaining : null,
            limit: typeof data.limit === 'number' ? data.limit : null,
            degraded: Boolean(data.degraded),
          });
        }
      } catch {
        if (!cancelled) setBetaSignupStatus('error');
      }
    };
    load();
    
    // Check for success message from password reset
    if (location.state?.message) {
      setMessage(location.state.message);
      // Clear the state to prevent the message from persisting on refresh
      navigate(location.pathname, { replace: true });
    }
    
    return () => {
      cancelled = true;
    };
  }, [location, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    
    // Basic validation
    if (!email.trim()) {
      setError('Email is required');
      setLoading(false);
      return;
    }
    
    if (!password.trim()) {
      setError('Password is required');
      setLoading(false);
      return;
    }

    // Validation for sign up
    if (isSignUp) {
      if (!firstName.trim()) {
        setError('First name is required');
        setLoading(false);
        return;
      }
      if (!lastName.trim()) {
        setError('Last name is required');
        setLoading(false);
        return;
      }
    }
    
    try {
      if (isSignUp) {
        const { error } = await signUp({ 
          email, 
          password, 
          options: {
            data: {
              first_name: firstName.trim(),
              last_name: lastName.trim()
            }
          }
        });
        if (error) throw error;
        setMessage('Check your email for a confirmation link!');
      } else {
        const { error } = await signIn({ 
          email: email.trim().toLowerCase(), 
          password: password.trim() 
        });
        if (error) throw error;
        navigate('/dashboard');
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };


  // Custom TopNav for auth page (without Get started button)
  const AuthTopNav = () => {
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
                color: l.id === 'auth' ? 'var(--fg)' : 'var(--mut)',
                fontSize: 16, padding: '15px 24px', borderRadius: 8,
                fontFamily: 'JetBrains Mono, monospace',
                letterSpacing: '.02em',
                position: 'relative'
              }}>
              {l.label}
              {l.id === 'auth' &&
                <span style={{
                  position: 'absolute', left: 12, right: 12, bottom: 4, height: 2,
                  background: 'var(--violet)', borderRadius: 2, backgroundColor: "rgb(242, 129, 29)"
                }} />
              }
            </button>
          )}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Empty div to maintain spacing - no Get started button on auth page */}
          <div style={{ width: '120px' }}></div>
        </div>
      </header>
    );
  };

  return (
    <div className="route dot-paper" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AuthTopNav />
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
      {/* LEFT — editorial poster */}
        <div className="auth-left-panel" style={{
          padding: '40px 70px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          borderRight: '1px solid var(--line)', position: 'relative', overflow: 'hidden'
        }}>
        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 28 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="sticker"><span className="dot-2" /> chapter one</span>
            <span className="sticker"><span className="dot-3" /> beta Trial</span>
            <span className="sticker">
              <span
                className="dot-4"
                style={{ background: betaSpotsStickerDotColor(betaSignupStatus, betaSeats) }}
              />
              {betaSpotsStickerLabel(betaSignupStatus, betaSeats)}
            </span>
          </div>
          <h2 className="serif" style={{
            fontSize: 'clamp(60px, 7.5vw, 110px)', lineHeight: .95, letterSpacing: '-.025em',
            margin: '30px 0 0'
          }}>
            Welcome <span style={{ fontStyle: 'italic' }} className="squiggle">back</span>,<br />
            researcher.
          </h2>
          <p className="auth-welcome-text" style={{ marginTop: 28, maxWidth: 525, fontSize: 20, lineHeight: 1.55, color: 'var(--mut)' }}>
            {isSignUp 
              ? 'Begin your research journey with AI-powered insights and data visualizations. Your new chapter starts here.'
              : 'Pick up where you left off, or start a fresh thread of inquiry. Your library is exactly where you parked it.'
            }
          </p>
        </div>

        {/* decorative annotated card */}
        <div className="auth-decorative-card" style={{ position: 'relative', marginTop: 50 }}>
          <div className="card" style={{
            padding: 22, transform: 'rotate(-2deg)', maxWidth: 475,
            background: 'var(--paper)'
          }}>
            <div className="mono" style={{ fontSize: 12, color: 'var(--mut2)', letterSpacing: '.18em' }}>TODAY'S NOTE</div>
            <div className="serif" style={{ fontSize: 30, lineHeight: 1.15, marginTop: 8, letterSpacing: '-.01em' }}>
              "The right question is half the <span className="marker">answer</span>."
            </div>
            <div className="mono" style={{ marginTop: 15, fontSize: 14, color: 'var(--mut)' }}>— charles kettering, 1944</div>
          </div>
          <div style={{ position: 'absolute', right: 65, top: -10 }}>
            <HandArrow rotate={150} color="var(--cyan)" />
          </div>
        </div>
      </div>

      {/* RIGHT — form */}
        <div className="auth-right-panel" style={{ padding: '40px 70px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="auth-form-stack" style={{ width: '100%', maxWidth: 475 }}>
          {/* mode switcher */}
          <div className="auth-mode-switch" style={{
            display: 'inline-flex', padding: 4, borderRadius: 999,
            background: 'var(--card)', border: '1px solid var(--line-strong)',
            marginBottom: 28
          }}>
            {[
              { mode: false, label: 'sign in' },
              { mode: true, label: 'create account' }
            ].map(({ mode, label }) =>
              <button key={label}                 onClick={() => {
                setIsSignUp(mode);
                setError('');
                setMessage('');
                setFirstName('');
                setLastName('');
              }}
              className="mono"
              disabled={loading || betaSignupStatus === 'loading'}
              style={{
                padding: '10px 20px', borderRadius: 999, border: 'none', cursor: 'pointer',
                background: isSignUp === mode ? 'rgb(242, 129, 29)' : 'transparent',
                color: isSignUp === mode ? 'white' : 'var(--mut)',
                fontFamily: 'JetBrains Mono, monospace', fontSize: 14, letterSpacing: '.02em'
              }}>
                {label}
              </button>
            )}
          </div>

          <h3 className="serif" style={{ fontSize: 45, lineHeight: 1.1, margin: 0, letterSpacing: '-.015em' }}>
            {isSignUp ? <>Begin a new <span style={{ fontStyle: 'italic' }}>chapter</span>.</> : <>Open the <span style={{ fontStyle: 'italic' }}>library</span>.</>}
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

          {/* Beta Signup Full Message */}
          {isSignUp && betaSignupStatus === 'full' && (
            <div style={{ 
              marginTop: 20, padding: '20px', borderRadius: 12,
              background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)',
              textAlign: 'center'
            }}>
              <h4 className="serif" style={{ fontSize: 18, margin: '0 0 8px', color: 'var(--fg)' }}>Beta is full</h4>
              <p style={{ fontSize: 14, margin: '0 0 8px', color: 'var(--mut)', lineHeight: 1.4 }}>
                {BETA_SIGNUP_FULL_MESSAGE}
              </p>
              <p className="mono" style={{ fontSize: 10, margin: 0, color: 'var(--mut2)', letterSpacing: '.02em' }}>
                You can still sign in if you already have an account.
              </p>
            </div>
          )}

          {/* Beta Signup Error */}
          {isSignUp && betaSignupStatus === 'error' && (
            <div style={{ 
              marginTop: 20, padding: '12px 16px', borderRadius: 8,
              background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)',
              color: '#d97706'
            }}>
              <p className="mono" style={{ fontSize: 12, margin: 0 }}>
                We couldn't confirm whether signups are open. Please try again in a moment.
              </p>
            </div>
          )}

          {!(isSignUp && betaSignupStatus === 'full') && (
            <form onSubmit={handleSubmit}
            style={{ marginTop: 26, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {isSignUp && (
                <div className="auth-name-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <Field 
                    label="First Name" 
                    type="text" 
                    placeholder="Hamza" 
                    value={firstName} 
                    onChange={setFirstName}
                    disabled={loading || (isSignUp && betaSignupStatus === 'error')}
                  />
                  <Field 
                    label="Last Name" 
                    type="text" 
                    placeholder="Mazari" 
                    value={lastName} 
                    onChange={setLastName}
                    disabled={loading || (isSignUp && betaSignupStatus === 'error')}
                  />
                </div>
              )}
              <Field 
                label="Email" 
                type="email" 
                placeholder="exmaple@email.com" 
                value={email} 
                onChange={setEmail}
                disabled={loading || (isSignUp && betaSignupStatus === 'error')}
              />
              <Field 
                label="Password" 
                type="password" 
                placeholder={isSignUp ? "at least 6 characters" : "enter your password"}
                value={password} 
                onChange={setPassword}
                disabled={loading || (isSignUp && betaSignupStatus === 'error')}
              />

              {isSignUp && (
                <p className="mono" style={{ fontSize: 10, color: 'var(--mut2)', margin: '4px 0 0', letterSpacing: '.02em' }}>
                  Password should be at least 6 characters long
                </p>
              )}

              {!isSignUp && (
                <div style={{ textAlign: 'right', marginTop: '8px' }}>
                  <button
                    type="button"
                    onClick={() => navigate('/forgot-password')}
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
                    Forgot your password?
                  </button>
                </div>
              )}

              <button 
                type="submit" 
                className="btn btn-primary" 
                disabled={loading || (isSignUp && (betaSignupStatus === 'error' || betaSignupStatus === 'loading'))}
                style={{ 
                  marginTop: 10, justifyContent: 'center', padding: '18px 22px', 
                  backgroundColor: "rgb(242, 129, 29)",
                  opacity: (loading || (isSignUp && (betaSignupStatus === 'error' || betaSignupStatus === 'loading'))) ? 0.6 : 1,
                  fontSize: '16px'
                }}
              >
                {loading ? (
                  <>
                    <div style={{ 
                      width: 16, height: 16, border: '2px solid white', borderTop: '2px solid transparent', 
                      borderRadius: '50%', animation: 'spin 1s linear infinite', marginRight: 8
                    }} />
                    {isSignUp ? 'Creating Account...' : 'Signing In...'}
                  </>
                ) : (
                  <>
                    {isSignUp ? 'Create Account' : 'Sign In'} <Icon.Arrow />
                  </>
                )}
              </button>
            </form>
          )}

          <p className="mono" style={{ marginTop: 28, fontSize: 13, color: 'var(--mut2)', letterSpacing: '.02em', textAlign: 'center' }}>
            by continuing you agree to our terms · privacy
          </p>
        </div>
      </div>
      </div>
    </div>
  );
};

export default LoginPage; 