import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { config } from '../config';
import { Icon, FrameDivider, HandArrow, TopNav, PIPELINE_STEP_DOT_COLORS } from './shared';
import HowToUse from './HowToUse';

function Welcome() {
  const navigate = useNavigate();
  const [betaSeats, setBetaSeats] = useState({
    status: 'loading',
    limit: null,
    spotsRemaining: null,
    signupOpen: null,
    degraded: null,
  });
  
  const go = (route) => {
    if (route === 'auth') {
      navigate('/login');
    } else {
      navigate(`/${route}`);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(config.endpoints.betaSignupStatus);
        if (cancelled) return;
        if (!res.ok) {
          setBetaSeats({
            status: 'error',
            limit: null,
            spotsRemaining: null,
            signupOpen: null,
            degraded: null,
          });
          return;
        }
        if (cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        const limitNum = typeof data.limit === 'number' ? data.limit : null;
        const spots =
          typeof data.spots_remaining === 'number' ? data.spots_remaining : null;
        const open = typeof data.signup_open === 'boolean' ? data.signup_open : null;
        setBetaSeats({
          status: 'ready',
          limit: limitNum,
          spotsRemaining: spots,
          signupOpen: open,
          degraded: Boolean(data.degraded),
        });
      } catch {
        if (!cancelled) {
          setBetaSeats((s) => ({ ...s, status: 'error' }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="route welcome-page" style={{ position: 'relative' }}>
      {/* TOP NAVIGATION */}
      <TopNav route="welcome" go={go} authed={false} />
      {/* HERO */}
      <section style={{ padding: '72px 48px 32px', position: 'relative' }}>
        <div
          className="welcome-hero-grid"
          style={{ maxWidth: 1400, margin: '0 auto', position: 'relative',
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'start' }}>

          {/* LEFT column — headline, sub, CTA */}
          <div className="welcome-hero-copy">
            {/* sticker badge */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 28, flexWrap: 'wrap' }}>
              <span className="sticker"><span className="dot" />
               v1.4</span>
              <span className="sticker mono" style={{ borderColor: 'var(--line)', color: 'var(--mut)'}}>
              <span className="dot" style={{ background: '#06B6D5' }} /> 
                  Claude 4.6 · Tavily · Citations
              </span>         
              <span className="sticker mono" style={{ borderColor: 'var(--line)', color: 'var(--mut)' }}>
              <span className="dot" style={{ background: '#7C5DFF' }} />  Beta Trial</span>

            </div>

            {/* hero headline */}
            <h1 className="welcome-hero-title" style={{
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
                Ask a research question. DeepResearch finds credible sources,
                synthesizes evidence, and gives you a report with real citations.
                <br /><br />
                You still write the essay — we just make the research 10x faster.
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
          <div className="welcome-hero-visual" style={{ alignSelf: 'center' }}>
            <div className="welcome-hero-collage-frame">
              <HeroCollage />
            </div>
          </div>
        </div>
      </section>

      {/* ETHICAL USAGE CALLOUT */}
      <section style={{ padding: '40px 48px 40px' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', justifyContent: 'center' }}>
          <div className="card" style={{
            padding: '40px 60px',
            textAlign: 'center',
            background: 'linear-gradient(135deg, var(--bg) 0%, var(--bg-2) 100%)',
            border: '2px solid var(--line-strong)',
            maxWidth: 800,
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* subtle accent background */}
            <div style={{
              position: 'absolute', top: -60, right: -60, width: 200, height: 200,
              borderRadius: '50%', background: 'var(--hot)', opacity: .08, filter: 'blur(30px)', pointerEvents: 'none'
            }} />
            
            <div className="sticker" style={{ 
              marginBottom: 24, 
              backgroundColor: 'var(--hot)', 
              color: 'white',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '.1em'
            }}>
              IMPORTANT
            </div>
            
            <h3 className="serif" style={{ 
              fontSize: 'clamp(28px, 3.5vw, 36px)', 
              lineHeight: 1.2, 
              letterSpacing: '-.02em',
              marginBottom: 20,
              color: 'var(--fg)'
            }}>
              USE IT <span className="marker-half">ETHICALLY</span>
            </h3>
            
            <p style={{ 
              fontSize: 16, 
              lineHeight: 1.6, 
              color: 'var(--mut)',
              marginBottom: 28,
              maxWidth: 600,
              margin: '0 auto 28px'
            }}>
              The report structure and sources are AI-generated.<br />
              The essay you submit should be <span style={{ fontWeight: 600, color: 'var(--fg)' }}>YOUR words</span>, <span style={{ fontWeight: 600, color: 'var(--fg)' }}>YOUR analysis</span>.
            </p>

            <div style={{ 
              fontSize: 14, 
              lineHeight: 1.7, 
              color: 'var(--mut)',
              marginBottom: 24,
              maxWidth: 500,
              margin: '0 auto 24px'
            }}>
              <div style={{ marginBottom: 8 }}>
                <span style={{ color: 'var(--hot)', marginRight: 8 }}>→</span>
                <span>Google Scholar finds sources — you still write</span>
              </div>
              <div style={{ marginBottom: 8 }}>
                <span style={{ color: 'var(--hot)', marginRight: 8 }}>→</span>
                <span>DeepResearch finds sources AND explains them — you still write</span>
              </div>
            </div>
            
            <p style={{ 
              fontSize: 15, 
              lineHeight: 1.5, 
              color: 'var(--fg)',
              fontWeight: 600,
              marginTop: 8
            }}>
              Use the research. Write your own essay.
            </p>
          </div>
        </div>
      </section>

      {/* PILLARS */}
      <section style={{ padding: '80px 48px 32px' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          <FrameDivider label="What it does" />
          <div className="welcome-pillars-grid" style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18, marginTop: 4
          }}>
            <Pillar
              num="01"
              title="A research foundation"
              tint="var(--violet)"
              body="Summaries of key findings, analysis of sources, charts with real data, and APA citations.

Background research organized for you.

Understand your topic. Then write your essay."
              chip="Research foundation" />
            
            <Pillar
              num="02"
              title="Citations from real sources"
              tint="var(--cyan)"
              body="Peer-reviewed journals (.edu, NCBI, Nature)
Government reports (.gov, WHO, UN)
Academic institutions (Stanford, MIT)
Reputable news sources (Reuters, BBC, NYT)

Every URL is clickable. Every citation is verifiable."
              chip="APA · live retrieval" />
            
            <Pillar
              num="03"
              title="Organized by default"
              tint="var(--hot)"
              body="Color-coded folders, a research timeline, smart follow-up questions — your work stays sorted instead of buried in tabs."
              chip="library/" />
            
          </div>
        </div>
      </section>

      {/* HOW TO USE DEEPRESEARCH */}
      <HowToUse />

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
          <div className="card welcome-beta-card" style={{ 
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
            
            <BetaSeatsHeading state={betaSeats} />
            
            <p style={{ 
              fontSize: 16, 
              lineHeight: 1.5, 
              color: 'var(--mut)',
              marginBottom: 32,
              maxWidth: 400,
              margin: '0 auto 32px'
            }}>
              Stop Googling at 3am. Start researching smarter.
              <br />
              5 free reports per <span className="marker-half">students</span> — 50 beta spots total.
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
        <div className="welcome-cta-panel" style={{
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
          <div className="welcome-cta-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 32, position: 'relative' }}>
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
        <div className="welcome-footer" style={{
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

function BetaSeatsHeading({ state }) {
  const serif = {
    fontSize: 'clamp(32px, 4vw, 48px)',
    lineHeight: 1.2,
    letterSpacing: '-.02em',
    marginBottom: 16,
  };
  const accent = 'rgb(242, 129, 29)';

  if (state.status === 'loading') {
    return (
      <div className="serif" style={serif}>
        Beta trial — <span style={{ fontStyle: 'italic', color: accent }}>limited seats</span><br />
        <span style={{ color: 'var(--mut)' }}>Checking signup availability…</span>
      </div>
    );
  }

  const lim =
    typeof state.limit === 'number' && state.limit > 0 ? state.limit : 50;
  const noLiveNumbers =
    state.status === 'error' ||
    state.degraded ||
    state.spotsRemaining == null ||
    state.signupOpen == null;

  if (noLiveNumbers) {
    return (
      <div className="serif" style={serif}>
        Beta trial — <span style={{ fontStyle: 'italic', color: accent }}>limited rollout</span><br />
        <span className="marker">{lim}</span> spots — join while signups stay open.
      </div>
    );
  }

  if (!state.signupOpen) {
    return (
      <div className="serif" style={serif}>
        Beta cohort is <span style={{ fontStyle: 'italic', color: accent }}>full</span><br />
        <span className="marker">{lim}</span> accounts — thanks for your interest.
      </div>
    );
  }

  return (
    <div className="serif" style={serif}>
      Beta trial — <span style={{ fontStyle: 'italic', color: accent }}>limited rollout</span><br />
      <span style={{ fontStyle: 'italic', color:'black' }}>spots remaining</span><br /><span className="marker">{state.spotsRemaining}</span>
      {' of '}
      {lim}
    </div>
  );
}

function HeroCollage() {
  return (
    <div className="welcome-hero-collage" style={{ position: 'relative', height: 600, overflow: 'hidden' }}>
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

      {/* main content card */}
      <div className="card" style={{
        position: 'absolute', top: 10, left: 20, width: 500,
        padding: 30, transform: 'rotate(2deg)',
        boxShadow: '0 20px 40px -20px rgba(124,92,255,.2)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <span className="sticker"><span className="dot-3" /> Ready to use</span>
          <span className="mono" style={{ fontSize: 10, color: 'var(--mut2)' }}>v1.4</span>
        </div>
        
        <div className="serif" style={{ fontSize: 32, lineHeight: 1.1, letterSpacing: '-.015em', marginBottom: 20 }}>
          Academic research, <span style={{ fontStyle: 'italic', color: 'var(--violet)' }}>simplified</span>
        </div>
        
        <p style={{ fontSize: 16, lineHeight: 1.6, color: 'var(--mut)', marginBottom: 24 }}>
          DeepResearch turns research questions into structured academic reports with real citations.
        </p>

        <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--mut)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 8 }}>
            <span style={{ color: 'var(--violet)', marginRight: 8, fontWeight: 'bold' }}>✓</span>
            <span>Searches academic databases and credible sources</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 8 }}>
            <span style={{ color: 'var(--violet)', marginRight: 8, fontWeight: 'bold' }}>✓</span>
            <span>Summarizes key findings and organizes sources</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 8 }}>
            <span style={{ color: 'var(--violet)', marginRight: 8, fontWeight: 'bold' }}>✓</span>
            <span>Creates data visualizations from real numbers</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 8 }}>
            <span style={{ color: 'var(--violet)', marginRight: 8, fontWeight: 'bold' }}>✓</span>
            <span>Provides APA citations you can verify</span>
          </div>
        </div>

        <p style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--fg)', marginTop: 20, fontWeight: 500 }}>
          From question to citation-ready report in minutes.
        </p>

        <button
          style={{
            marginTop: 24,
            padding: '12px 20px',
            backgroundColor: 'rgb(242, 129, 29)',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            fontFamily: 'Geist, sans-serif',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: '0 2px 8px rgba(242, 129, 29, 0.3)',
            transition: 'all 0.2s ease'
          }}
          onMouseOver={(e) => {
            e.target.style.transform = 'translateY(-1px)';
            e.target.style.boxShadow = '0 4px 12px rgba(242, 129, 29, 0.4)';
          }}
          onMouseOut={(e) => {
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = '0 2px 8px rgba(242, 129, 29, 0.3)';
          }}
        >
          Start researching
        </button>
      </div>

      {/* tiny floating sticker */}
      <div className="welcome-collage-sticker" style={{
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
      <div className="welcome-collage-arrow" style={{ position: 'absolute', top: 300, left: -43 }}>
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
    { n: '02', t: 'We read', d: 'Claude searches live academic sources and ranks by credibility. Verifies every citation.' },
    { n: '03', t: 'It compiles', d: 'A structured research brief with summaries, evidence, and counter-arguments.' },
    { n: '04', t: 'You use it', d: 'Export to PDF or Word to reference while writing. Or ask follow-ups to go deeper.' },
  ].map((s, i) => ({ ...s, c: PIPELINE_STEP_DOT_COLORS[i] }));

  return (
    <div className="welcome-pipeline-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, marginTop: 6 }}>
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