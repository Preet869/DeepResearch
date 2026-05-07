import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon, FrameDivider, HandArrow, TopNav, PIPELINE_STEP_DOT_COLORS } from './shared';

function Welcome() {
  const navigate = useNavigate();
  
  const go = (route) => {
    if (route === 'auth') {
      navigate('/login');
    } else {
      navigate(`/${route}`);
    }
  };

  return (
    <div className="route" style={{ position: 'relative' }}>
      {/* TOP NAVIGATION */}
      <TopNav route="welcome" go={go} authed={false} />
      {/* HERO */}
      <section style={{ padding: '72px 48px 32px', position: 'relative' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', position: 'relative',
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'start' }}>

          {/* LEFT column — headline, sub, CTA */}
          <div>
            {/* sticker badge */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 28, flexWrap: 'wrap' }}>
              <span className="sticker"><span className="dot" />
               v1.4 — now with comparison</span>
              <span className="sticker mono" style={{ borderColor: 'var(--line)', color: 'var(--mut)'}}>
              <span className="dot" style={{ background: '#06B6D5' }} /> 
                  Claude 4.6 · Tavily · Citations
              </span>         
              <span className="sticker mono" style={{ borderColor: 'var(--line)', color: 'var(--mut)' }}>
              <span className="dot" style={{ background: '#7C5DFF' }} />  Beta Trial</span>

            </div>

            {/* hero headline */}
            <h1 style={{
              margin: 0,
              fontFamily: 'Instrument Serif, Georgia, serif',
              fontWeight: 400,
              fontSize: '85px',
              lineHeight: 0.95,
              letterSpacing: '-1.8348px',
              color: '#15182a',
              textAlign: 'left',
              width: '515.547px',
              height: '209.156px',
              opacity: 1
            }}>
              Research,<br />
              <span style={{ fontStyle: 'italic' }}>in <span className="squiggle">minutes</span>,</span><br />
              not <span className="marker-half">weeks</span>.
            </h1>

            <div style={{ marginTop: 48 }}>
              <p style={{
                fontSize: 20, lineHeight: 1.5, color: 'var(--mut)',
                maxWidth: 520, margin: 0
              }}>
                Type any question. DeepResearch reads the web, synthesizes sources,
                draws the charts, and hands you a citation-ready report you can defend.
              </p>

              {/* Auth CTA Button - replacing the search form */}
              <div style={{ marginTop: 32 }}>
                <button 
                  onClick={() => go('auth')}
                  className="btn btn-primary" 
                  style={{ 
                    padding: '16px 24px', 
                    backgroundColor: "rgb(242, 129, 29)",
                    border: 'none',
                    borderRadius: 12,
                    color: 'white',
                    fontSize: 16,
                    fontWeight: 600,
                    fontFamily: 'Geist, sans-serif',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    boxShadow: '0 4px 16px rgba(242, 129, 29, 0.3)',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseOver={(e) => {
                    e.target.style.transform = 'translateY(-1px)';
                    e.target.style.boxShadow = '0 6px 20px rgba(242, 129, 29, 0.4)';
                  }}
                  onMouseOut={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 4px 16px rgba(242, 129, 29, 0.3)';
                  }}
                >
                  Get Started <Icon.Arrow />
                </button>
              </div>
            </div>

          </div>

          {/* RIGHT column — hero collage */}
          <div style={{ alignSelf: 'center' }}>
            <HeroCollage />
          </div>
        </div>
      </section>

      {/* PILLARS */}
      <section style={{ padding: '80px 48px 32px' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          <FrameDivider label="What it does" />
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18, marginTop: 4
          }}>
            <Pillar
              num="01"
              title="A real report"
              tint="var(--violet)"
              body="Executive summary, literature review, critical analysis, charts and APA citations — the whole structure your professor expects."
              chip="report.pdf" />
            
            <Pillar
              num="02"
              title="Side-by-side compare"
              tint="var(--cyan)"
              body="Drop two articles. Get a comparison of methodology, findings, evidence quality, and practical implications in seconds."
              chip="paper-A · paper-B" />
            
            <Pillar
              num="03"
              title="Organized by default"
              tint="var(--hot)"
              body="Color-coded folders, a research timeline, smart follow-up questions — your work stays sorted instead of buried in tabs."
              chip="library/" />
            
          </div>
        </div>
      </section>

      {/* HOW IT WORKS — editorial spread */}
      <section style={{ padding: '40px 48px 40px' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          <FrameDivider label="The four-step pipeline" />
          <Pipeline />
        </div>
      </section>

      {/* TESTIMONIAL / QUOTE */}
      <section style={{ padding: '40px 48px 80px' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', justifyContent: 'center' }}>
          <div className="card" style={{ 
            padding: '48px 60px', 
            textAlign: 'center', 
            background: 'linear-gradient(135deg, var(--bg) 0%, var(--bg-2) 100%)',
            border: '2px solid var(--line-strong)',
            maxWidth: 600,
            margin: '0 auto'
          }}>
            <div className="sticker" style={{ 
              marginBottom: 24, 
              backgroundColor: '#EF4444', 
              color: 'white',
              fontSize: 12,
              fontWeight: 600
            }}>
              <span />  Beta Access
            </div>
            
            <div className="serif" style={{ 
              fontSize: 'clamp(32px, 4vw, 48px)', 
              lineHeight: 1.2, 
              letterSpacing: '-.02em',
              marginBottom: 16
            }}>
              Beta trial — <span style={{ fontStyle: 'italic', color: 'rgb(242, 129, 29)' }}>only first</span><br />
              <span className="marker">50 users</span> can use it.
            </div>
            
            <p style={{ 
              fontSize: 16, 
              lineHeight: 1.5, 
              color: 'var(--mut)',
              marginBottom: 32,
              maxWidth: 400,
              margin: '0 auto 32px'
            }}>
              Get exclusive early access to DeepResearch and help shape the future of AI-powered research.
            </p>
            
            <button 
              onClick={() => go('auth')}
              className="btn btn-primary" 
              style={{ 
                padding: '16px 32px', 
                backgroundColor: "rgb(242, 129, 29)",
                fontSize: 16,
                fontWeight: 600,
                fontFamily: 'Geist, sans-serif'
              }}
            >
              Claim Your Spot <Icon.Arrow />
            </button>
          </div>
        </div>
      </section>

      {/* CTA STRIP */}
      <section style={{ padding: '0 48px 32px' }}>
        <div style={{
          maxWidth: 1400, margin: '0 auto',
          padding: '56px 48px',
          borderRadius: 22,
          background: 'linear-gradient(135deg, var(--violet) 0%, #4F33C8 100%)',
          position: 'relative',
          overflow: 'hidden', color: "rgb(255, 255, 255)"
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'radial-gradient(rgba(255,255,255,.18) 1px, transparent 1px)',
            backgroundSize: '18px 18px', opacity: .35, pointerEvents: 'none'
          }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 32, position: 'relative' }}>
            <div>
              <div className="mono" style={{ fontSize: 11, opacity: .8, letterSpacing: '.16em', textTransform: 'uppercase' }}>
                free to start · no credit card
              </div>
              <h3 className="serif" style={{ margin: '8px 0 0', fontSize: 'clamp(34px, 4.4vw, 56px)', lineHeight: 1, letterSpacing: '-.02em' }}>
                Pick a question. <span style={{ fontStyle: 'italic' }}>We'll handle the rest.</span>
              </h3>
            </div>
            <button onClick={() => go('auth')}
              style={{
                background: 'white', color: 'var(--violet-2)',
                padding: '16px 22px', borderRadius: 12,
                border: 'none', cursor: 'pointer',
                fontFamily: 'Geist, sans-serif', fontWeight: 600, fontSize: 15,
                whiteSpace: 'nowrap',
                display: 'inline-flex', alignItems: 'center', gap: 8
              }}>
              Start free <Icon.Arrow />
            </button>
          </div>
        </div>

        {/* footer mini */}
        <div style={{
          maxWidth: 1400, margin: '32px auto 0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          color: 'var(--mut2)', fontSize: 12,
          fontFamily: 'JetBrains Mono, monospace', letterSpacing: '.04em'
        }}>
          <span>© 2026 deepresearch labs</span>
          <span style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>made for the curious</span>
          <span>v1.4.0</span>
        </div>
      </section>
    </div>
  );
}

function HeroCollage() {
  return (
    <div style={{ position: 'relative', height: 600, overflow: 'hidden' }}>
      {/* paper bg card — tilted */}
      <div className="card" style={{
        position: 'absolute', top: 50, right: 10, width: 420, height: 480,
        transform: 'rotate(-4deg)',
        background: 'var(--paper)',
        backgroundImage: 'linear-gradient(transparent calc(28px - 1px), var(--line) 28px)',
        backgroundSize: '100% 28px',
        boxShadow: '0 20px 40px -20px rgba(0,0,0,.15)',
        padding: 22
      }}>
        <div className="mono" style={{ fontSize: 10, color: 'var(--mut2)', letterSpacing: '.18em', marginBottom: 8 }}>NOTES.MD</div>
        <div className="serif" style={{ fontSize: 22, lineHeight: 1.15, letterSpacing: '-.01em' }}>
          AI-powered<br /> research —<br /> <span style={{ fontStyle: 'italic', color: 'var(--violet)' }}>methodology review</span>
        </div>
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {['Chen et al. (2023)', 'Taylor & Smith (2024)', 'Rodriguez et al. (2025)'].map((s) =>
            <div key={s} className="mono" style={{ fontSize: 11, color: 'var(--mut)', letterSpacing: '.02em' }}>
              <span style={{ color: 'var(--violet)' }}>›</span>&nbsp; {s}
            </div>
          )}
        </div>
      </div>

      {/* main report card */}
      <div className="card" style={{
        position: 'absolute', top: 10, left: 0, width: 500,
        padding: 30, transform: 'rotate(2deg)',
        boxShadow: '0 20px 40px -20px rgba(124,92,255,.2)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span className="sticker"><span className="dot-3" /> Generated · 17s</span>
          <span className="mono" style={{ fontSize: 10, color: 'var(--mut2)' }}>r-2407</span>
        </div>
        <div className="serif" style={{ fontSize: 32, lineHeight: 1.1, letterSpacing: '-.015em' }}>
          The future of <span style={{ fontStyle: 'italic', color: 'var(--violet)' }}>AI-powered</span> research
        </div>
        <p style={{ marginTop: 16, fontSize: 16, lineHeight: 1.55, color: 'var(--mut)' }}>
          Advanced AI systems have demonstrated a <span className="marker" style={{ color: 'var(--fg)' }}>67% improvement</span> in
          research synthesis speed<span className="cite">12</span>, with emerging applications
          spanning multiple academic disciplines<span className="cite">7</span>.
        </p>

        {/* tiny chart */}
        <div style={{ marginTop: 20, height: 100, padding: 14, borderRadius: 8, background: 'var(--bg-2)', border: '1px solid var(--line)' }}>
          <svg viewBox="0 0 280 72" width="100%" height="100%">
            <path d="M0 60 L30 54 L60 48 L90 46 L120 40 L150 32 L180 28 L210 22 L240 18 L280 14"
              stroke="var(--violet)" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d="M0 60 L30 54 L60 48 L90 46 L120 40 L150 32 L180 28 L210 22 L240 18 L280 14 L280 72 L0 72 Z"
              fill="var(--violet)" opacity=".18" style={{ fill: "rgb(242, 129, 29)" }} />
            {[0, 30, 60, 90, 120, 150, 180, 210, 240, 280].map((x, i) => {
              const ys = [60, 54, 48, 46, 40, 32, 28, 22, 18, 14];
              return <circle key={i} cx={x} cy={ys[i]} r="3" fill="var(--violet)" />;
            })}
          </svg>
        </div>
        <div className="mono" style={{ marginTop: 8, fontSize: 12, color: 'var(--mut2)', letterSpacing: '.04em' }}>
          fig. 1 — research automation adoption, 2020–2026
        </div>
      </div>

      {/* tiny floating sticker */}
      <div style={{
        position: 'absolute', bottom: 40, left: 320,
        transform: 'rotate(-8deg)',
        background: '#FFD23F', color: '#1A1300',
        padding: '8px 14px', borderRadius: 8,
        fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
        boxShadow: '0 8px 16px -6px rgba(0,0,0,.2)',
        border: '1px solid rgba(0,0,0,.2)'
      }}>
        ✱ 14 sources · cited
      </div>

      {/* scribble arrow */}
      <div style={{ position: 'absolute', top: 220, left: -10 }}>
        <HandArrow rotate={20} color="var(--cyan)" />
      </div>
    </div>
  );
}

function Pillar({ num, title, body, tint, chip }) {
  return (
    <div className="card" style={{ padding: 26, position: 'relative', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', top: -30, right: -30, width: 120, height: 120,
        borderRadius: '50%', background: tint, opacity: .14, filter: 'blur(20px)', pointerEvents: 'none'
      }} />
      <div className="mono" style={{ fontSize: 11, color: tint, letterSpacing: '.18em' }}>{num}</div>
      <div className="serif" style={{ fontSize: 32, lineHeight: 1.05, letterSpacing: '-.015em', marginTop: 8 }}>
        {title}
      </div>
      <p style={{ marginTop: 12, fontSize: 14, color: 'var(--mut)', lineHeight: 1.55 }}>{body}</p>
      <div className="mono" style={{
        marginTop: 18, padding: '6px 10px', borderRadius: 6,
        background: 'var(--bg-2)', border: '1px solid var(--line)',
        display: 'inline-block', fontSize: 11, color: 'var(--mut)'
      }}>{chip}</div>
    </div>
  );
}

function Pipeline() {
  const steps = [
    { n: '01', t: 'You ask', d: 'Type any research question — natural language, no syntax.' },
    { n: '02', t: 'We read', d: 'Tavily pulls live sources; GPT-4o ranks and de-duplicates.' },
    { n: '03', t: 'It writes', d: 'A structured report with charts, evidence, counter-points.' },
    { n: '04', t: 'You ship', d: 'Export to PDF, Markdown, JSON. Or branch into follow-ups.' },
  ].map((s, i) => ({ ...s, c: PIPELINE_STEP_DOT_COLORS[i] }));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, marginTop: 6 }}>
      {steps.map((s, i) =>
        <div key={s.n} style={{
          padding: '20px 22px',
          borderRight: i < 3 ? '1px solid var(--line)' : 'none',
          position: 'relative'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.c, boxShadow: `0 0 10px ${s.c}` }} />
            <span className="mono" style={{ fontSize: 11, color: 'var(--mut2)', letterSpacing: '.18em' }}>STEP {s.n}</span>
          </div>
          <div className="serif" style={{ fontSize: 30, lineHeight: 1, letterSpacing: '-.02em' }}>
            {i === 1 || i === 3 ? <span style={{ fontStyle: 'italic' }}>{s.t}</span> : s.t}
          </div>
          <p style={{ marginTop: 10, fontSize: 13, color: 'var(--mut)', lineHeight: 1.5 }}>{s.d}</p>
        </div>
      )}
    </div>
  );
}

export default Welcome;