import React from 'react';
import { FrameDivider } from './shared';

function HowToUse() {
  return (
    <section style={{ padding: '80px 48px 32px' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <FrameDivider label="How to use DeepResearch" />
        <div className="welcome-pillars-grid" style={{
          display: 'grid', 
          gridTemplateColumns: 'repeat(3, 1fr)', 
          gap: 18, 
          marginTop: 4
        }}>
          <Pillar
            num="01"
            title="Ask specific questions"
            tint="#10B981"
            body="Good: 'How does sleep deprivation affect academic performance?' — Not: Pasting your whole assignment"
            chip="Be specific" />
          
          <Pillar
            num="02"
            title="Use the citations"
            tint="#F59E0B"
            body="Every source is real and verifiable — no hallucinated citations. Click 'View All Sources' for APA references ready to cite."
            chip="Real sources" />
          
          <Pillar
            num="03"
            title="Ask follow-ups"
            tint="#EC4899"
            body="Got your report? Keep going deeper with follow-up questions. Each answer builds on the last."
            chip="Go deeper" />
        </div>
      </div>
    </section>
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

export default HowToUse;