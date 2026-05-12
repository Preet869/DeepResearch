import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { supabase } from './supabaseClient';
import { getUserFirstName } from './utils/userDisplayName';
import { Wordmark } from './components/shared';

function Header() {
  const { user, signOut, isAdmin, researchCreationBlocked } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const userMenuRef = useRef(null);

  useEffect(() => {
    if (!user?.id || !supabase) {
      setUserProfile(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('first_name, full_name')
        .eq('id', user.id)
        .maybeSingle();
      if (!cancelled) setUserProfile(data || null);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!showUserMenu) return;
    const onPointerDown = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [showUserMenu]);

  useEffect(() => {
    if (!showUserMenu) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setShowUserMenu(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showUserMenu]);

  const handleLogout = async () => {
    setShowUserMenu(false);
    await signOut();
    navigate('/login');
  };

  const path = location.pathname;
  const headerDisplayName = user ? getUserFirstName(userProfile, user) : '';

  const navItem = (to, label, opts = {}) => {
    const { accentResearch } = opts;
    const active =
      to === '/dashboard'
        ? path === '/dashboard'
        : path === to || path.startsWith(`${to}/`);
    return (
      <Link
        to={to}
        className="mono"
        style={{
          textDecoration: 'none',
          color: active ? 'var(--fg)' : 'var(--mut)',
          fontSize: 15,
          padding: '12px 18px',
          borderRadius: 8,
          letterSpacing: '.08em',
          position: 'relative',
          fontFamily: 'JetBrains Mono, monospace',
        }}
      >
        {label}
        {active && (
          <span
            style={{
              position: 'absolute',
              left: 10,
              right: 10,
              bottom: 4,
              height: 3,
              borderRadius: 2,
              background: accentResearch ? '#FEE092' : 'var(--violet)',
            }}
          />
        )}
      </Link>
    );
  };

  const navResearch = () => {
    const active = path === '/research' || path.startsWith('/research/');
    if (researchCreationBlocked) {
      return (
        <span
          className="mono"
          title="At beta cap — deletes won&apos;t refill"
          style={{
            fontSize: 15,
            padding: '12px 18px',
            borderRadius: 8,
            letterSpacing: '.08em',
            position: 'relative',
            fontFamily: 'JetBrains Mono, monospace',
            color: active ? 'var(--fg)' : 'var(--mut2)',
            opacity: active ? 1 : 0.42,
            cursor: 'not-allowed',
            userSelect: 'none',
          }}
        >
          Research
          {active && (
            <span
              style={{
                position: 'absolute',
                left: 10,
                right: 10,
                bottom: 4,
                height: 3,
                borderRadius: 2,
                background: '#FEE092',
              }}
            />
          )}
        </span>
      );
    }
    return navItem('/research', 'Research', { accentResearch: true });
  };

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 28px',
        borderBottom: '1px solid var(--line)',
        background: 'color-mix(in srgb, var(--bg) 92%, transparent)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        flexShrink: 0,
        zIndex: 40,
      }}
    >
      <Link
        to="/"
        style={{
          textDecoration: 'none',
          color: 'inherit',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          flexShrink: 0,
        }}
      >
        <Wordmark large />
        <span
          className="mono"
          style={{
            fontSize: 11,
            letterSpacing: '0.06em',
            color: 'var(--mut)',
            padding: '5px 10px',
            borderRadius: 999,
            border: '1px solid color-mix(in srgb, var(--violet) 35%, var(--line))',
            background: 'color-mix(in srgb, var(--violet) 6%, transparent)',
            lineHeight: 1.2,
            flexShrink: 0,
          }}
        >
          We are in beta
        </span>
      </Link>

      {user && (
        <nav
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        >
          {navItem('/dashboard', 'Library')}
          {navResearch()}
          {isAdmin && navItem('/compare', 'Compare')}
        </nav>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {user ? (
          <div ref={userMenuRef} style={{ position: 'relative' }}>
            <button
              type="button"
              aria-expanded={showUserMenu}
              aria-haspopup="menu"
              title={user.email || undefined}
              onClick={() => setShowUserMenu((v) => !v)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid var(--line)',
                background: 'var(--card)',
                color: 'var(--fg)',
                cursor: 'pointer',
                fontSize: 13,
                maxWidth: 220,
                fontFamily: 'Geist, sans-serif',
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {headerDisplayName}
              </span>
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showUserMenu && (
              <div
                role="menu"
                className="card"
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 'calc(100% + 8px)',
                  minWidth: 200,
                  padding: 8,
                  zIndex: 80,
                  boxShadow: '0 8px 28px rgba(0,0,0,0.12)',
                }}
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleLogout}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 12px',
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--fg)',
                    cursor: 'pointer',
                    borderRadius: 6,
                    fontSize: 14,
                    fontFamily: 'Geist, sans-serif',
                  }}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link to="/login" className="btn btn-primary" style={{ textDecoration: 'none' }}>
            Sign In
          </Link>
        )}
      </div>
    </header>
  );
}

export default Header;
