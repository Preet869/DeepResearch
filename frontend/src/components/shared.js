import React from 'react';

const Icon = {
  Search: (p) =>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
    </svg>,

  Arrow: (p) =>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M5 12h14" /><path d="M13 5l7 7-7 7" />
    </svg>,

  Folder: (p) =>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4l2 2.5h9a1.5 1.5 0 0 1 1.5 1.5v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5v-12z" />
    </svg>,

  Compare: (p) =>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="4" width="8" height="16" rx="1.5" /><rect x="13" y="4" width="8" height="16" rx="1.5" />
    </svg>,

  Spark: (p) =>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
      <path d="M19 16l.7 1.8L21.5 18.5l-1.8.7L19 21l-.7-1.8L16.5 18.5l1.8-.7z" opacity=".5" />
    </svg>,

  Plus: (p) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}><path d="M12 5v14M5 12h14" /></svg>,
  Check: (p) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20 6L9 17l-5-5" /></svg>,
  Quote: (p) => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M7 7h4v4H7v3a4 4 0 0 1-4 4v-2a2 2 0 0 0 2-2H3V7h4zm10 0h4v4h-4v3a4 4 0 0 1-4 4v-2a2 2 0 0 0 2-2h-2V7h4z" /></svg>,
  Download: (p) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 4v12" /><path d="M7 11l5 5 5-5" /><path d="M5 20h14" /></svg>,
  Share: (p) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="M8.2 10.6l7.6-4.2M8.2 13.4l7.6 4.2" /></svg>,
  Logo: (p) =>
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none" {...p}>
      <rect x="2" y="2" width="28" height="28" rx="7" fill="rgb(242, 129, 29)" />
      <path d="M9 11.5 C9 9, 11 8, 13 8 L20 8 C 23.5 8, 24 11, 22 13 C 24.5 13, 25 17, 22 18 L13 18 C 11 18, 9 17, 9 14.5 Z" stroke="var(--bg)" strokeWidth="1.6" fill="none" />
      <circle cx="22" cy="22" r="3" fill="var(--violet)" />
      <path d="M24.5 24.5 L 27 27" stroke="var(--violet)" strokeWidth="2" strokeLinecap="round" />
    </svg>
};

function Wordmark({ small, large, researchAccent }) {
  const sz = large ? 32 : small ? 22 : 28;
  const researchStyle = researchAccent
    ? {
        fontStyle: 'italic',
        background: '#FEE092',
        color: '#15182a',
        padding: '2px 8px',
        borderRadius: 6,
      }
    : {
        fontStyle: 'italic',
        color: 'rgb(242, 129, 29)',
      };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <Icon.Logo width={sz} height={sz} />
      <span className="serif" style={{ fontSize: small ? 22 : large ? 30 : 26, lineHeight: 1, letterSpacing: '-.02em' }}>
        Deep<span className="ital" style={researchStyle}>research</span>
      </span>
    </div>
  );
}

// signature divider with editorial frame ticks
function FrameDivider({ label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '36px 0 18px' }}>
      <div className="mono" style={{ fontSize: 11, color: 'var(--mut2)', letterSpacing: '.18em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
    </div>
  );
}

// hand-drawn arrow svg
function HandArrow({ rotate = 0, color = 'var(--violet)', w = 100, h = 60 }) {
  return (
    <svg width={w} height={h} viewBox="0 0 100 60" fill="none" style={{ transform: `rotate(${rotate}deg)` }}>
      <path d="M5 10 C 25 5, 45 25, 50 40 C 55 50, 70 52, 88 45"
        stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M82 38 L 90 46 L 80 50" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

function TopNav({ route, go, authed }) {
  const links = authed ?
    [
      { id: 'dashboard', label: 'Library' },
      { id: 'research', label: 'Research' },
      { id: 'compare', label: 'Compare' }
    ] :
    [
      { id: 'welcome', label: 'Home' },
      { id: 'auth', label: 'Sign In' }
    ];

  return (
    <header style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '20px 36px', borderBottom: '1px solid var(--line)',
      position: 'sticky', top: 0, zIndex: 50,
      background: 'color-mix(in srgb, var(--bg) 88%, transparent)',
      backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)'
    }}>
      <div onClick={() => go(authed ? 'dashboard' : '')} style={{ cursor: 'pointer' }}>
        <Wordmark />
      </div>

      <nav style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
        {links.map((l) =>
          <button key={l.id} onClick={() => go(l.id)} className="mono"
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: route === l.id ? 'var(--fg)' : 'var(--mut)',
              fontSize: 16, padding: '15px 24px', borderRadius: 8,
              fontFamily: 'JetBrains Mono, monospace',
              letterSpacing: '.02em',
              position: 'relative'
            }}>
            {l.label}
            {route === l.id &&
              <span style={{
                position: 'absolute', left: 12, right: 12, bottom: 4, height: 2,
                background: 'var(--violet)', borderRadius: 2, backgroundColor: "rgb(242, 129, 29)"
              }} />
            }
          </button>
        )}
      </nav>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {!authed ?
          <button className="btn btn-primary" onClick={() => go('auth')} style={{ backgroundColor: "rgb(242, 129, 29)" }}>
            Get started <Icon.Arrow />
          </button> :
          <button className="btn btn-new-research" onClick={() => go('research')}>
            <Icon.Plus /> New research
          </button>
        }
      </div>
    </header>
  );
}

/** Welcome page “four-step pipeline” dot colors (STEP 01–04). Same order as {@link Welcome} Pipeline. */
export const PIPELINE_STEP_DOT_COLORS = [
  'var(--violet)',
  'var(--cyan)',
  'var(--hot)',
  'var(--sun)',
];

/** Glowing step dot — matches Welcome.js Pipeline inline style. */
export function pipelineStepDotStyle(color, { emphasize = false } = {}) {
  const spread = emphasize ? 14 : 10;
  return {
    background: color,
    color: '#ffffff',
    boxShadow: `0 0 ${spread}px ${color}`,
  };
}

export { Icon, Wordmark, FrameDivider, HandArrow, TopNav };