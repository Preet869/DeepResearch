import React from 'react';
import { pipelineStepDotStyle } from '../shared';

/**
 * Focus / lens chip (Welcome pipeline parity: optional `dotColor` → glowing circle like STEP 01–04).
 */
export function Pill({ icon, label, selected, onClick, type = 'button', dotColor, variant = 'default' }) {
  const comfortable = variant === 'comfortable';
  return (
    <button
      type={type}
      onClick={onClick}
      className="mono"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: comfortable ? 9 : 8,
        padding: comfortable ? '10px 16px' : '8px 12px',
        borderRadius: 999,
        fontSize: comfortable ? 14 : 12,
        letterSpacing: '0.04em',
        cursor: 'pointer',
        border: selected ? '1px solid var(--violet)' : '1px solid var(--line)',
        background: selected ? 'color-mix(in srgb, var(--violet) 12%, var(--card))' : 'var(--card)',
        color: selected ? 'var(--fg)' : 'var(--mut)',
        transition: 'border 0.15s, background 0.15s',
      }}
    >
      {dotColor ? (
        <span
          style={{
            width: comfortable ? 9 : 8,
            height: comfortable ? 9 : 8,
            borderRadius: '50%',
            flexShrink: 0,
            ...pipelineStepDotStyle(dotColor, { emphasize: selected }),
          }}
        />
      ) : (
        <span style={{ opacity: 0.85 }}>{icon}</span>
      )}
      {label}
    </button>
  );
}

/**
 * Side-by-side paper URL/text input (reference: PaperInput).
 * Global mode is URL or text for both papers — passed from parent.
 */
export function PaperInput({
  letter,
  tint,
  inputMethod,
  onSwitchToText,
  urlValue,
  onUrlChange,
  titleValue,
  onTitleChange,
  textValue,
  onTextChange,
  urlPlaceholder = 'Paste a URL',
  titlePlaceholder = 'Title (optional)',
  textPlaceholder = 'Paste full article text…',
  variant = 'default',
}) {
  const comfortable = variant === 'comfortable';
  const pad = comfortable ? '14px 16px' : '12px 14px';
  const fs = comfortable ? 15 : 13;
  const fsMeta = comfortable ? 12 : 11;
  const letterSz = comfortable ? 26 : 22;
  const box = comfortable ? 38 : 32;
  const cardPad = comfortable ? 22 : 18;
  const innerGap = comfortable ? 14 : 12;

  return (
    <div
      className="card"
      style={{
        padding: cardPad,
        display: 'flex',
        flexDirection: 'column',
        gap: innerGap,
        borderColor: tint,
        borderWidth: 1,
        borderStyle: 'solid',
        boxShadow:
          tint === 'var(--cyan)'
            ? '0 30px 60px -30px rgba(6, 182, 212, 0.38)'
            : '0 30px 60px -30px rgba(124, 92, 255, 0.4)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span
          style={{
            width: box,
            height: box,
            borderRadius: 8,
            background: tint,
            color: 'white',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: "'Instrument Serif', serif",
            fontSize: letterSz,
            fontStyle: 'italic',
          }}
        >
          {letter}
        </span>
        <span className="mono" style={{ fontSize: fsMeta, color: 'var(--mut2)', letterSpacing: '.14em' }}>
          PAPER {letter}
        </span>
      </div>

      {inputMethod === 'url' ? (
        <>
          <input
            value={urlValue}
            onChange={(e) => onUrlChange(e.target.value)}
            placeholder={urlPlaceholder}
            type="url"
            style={{
              padding: pad,
              borderRadius: 10,
              border: '1px solid var(--line-strong)',
              background: 'var(--bg-2)',
              color: 'var(--fg)',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: fs,
              outline: 'none',
              width: '100%',
              boxSizing: 'border-box',
            }}
          />
          <button
            type="button"
            onClick={onSwitchToText}
            style={{
              background: 'transparent',
              border: '1px dashed var(--line-strong)',
              padding: comfortable ? '12px 14px' : '10px 12px',
              borderRadius: 8,
              color: 'var(--mut)',
              cursor: 'pointer',
              fontSize: fs,
              textAlign: 'left',
            }}
          >
            or paste full text →
          </button>
        </>
      ) : (
        <>
          <input
            value={titleValue}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder={titlePlaceholder}
            type="text"
            style={{
              padding: pad,
              borderRadius: 10,
              border: '1px solid var(--line-strong)',
              background: 'var(--bg-2)',
              color: 'var(--fg)',
              fontSize: comfortable ? 15 : 14,
              outline: 'none',
              width: '100%',
              boxSizing: 'border-box',
            }}
          />
          <textarea
            value={textValue}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder={textPlaceholder}
            rows={8}
            style={{
              padding: pad,
              borderRadius: 10,
              border: '1px solid var(--line-strong)',
              background: 'var(--bg-2)',
              color: 'var(--fg)',
              fontSize: comfortable ? 15 : 14,
              lineHeight: 1.45,
              outline: 'none',
              width: '100%',
              boxSizing: 'border-box',
              resize: 'vertical',
              minHeight: comfortable ? 140 : 120,
            }}
          />
        </>
      )}
    </div>
  );
}

/** Results column header (reference: PaperHeader) */
export function PaperHeader({ letter, tint, title, sub }) {
  return (
    <div style={{ padding: '6px 16px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: tint,
            color: 'white',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: "'Instrument Serif', serif",
            fontStyle: 'italic',
            fontSize: 19,
            flexShrink: 0,
          }}
        >
          {letter}
        </span>
        <div className="serif" style={{ fontSize: 22, letterSpacing: '-.01em', minWidth: 0 }}>
          {title}
        </div>
      </div>
      {sub ? (
        <div className="mono" style={{ marginTop: 4, fontSize: 11, color: 'var(--mut2)', letterSpacing: '.04em' }}>
          {sub}
        </div>
      ) : null}
    </div>
  );
}

function BarRow({ letter, tint, value, width }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: 5,
          background: tint,
          color: 'white',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "'Instrument Serif', serif",
          fontStyle: 'italic',
          fontSize: 14,
          flexShrink: 0,
        }}
      >
        {letter}
      </span>
      <div
        style={{
          flex: 1,
          height: 22,
          background: 'var(--bg-2)',
          borderRadius: 5,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${width}%`,
            height: '100%',
            background: tint,
            opacity: 0.85,
            transition: 'width .3s',
          }}
        />
      </div>
      <span className="mono" style={{ fontSize: 12, color: 'var(--fg)', minWidth: 36, textAlign: 'right' }}>
        {value}
      </span>
    </div>
  );
}

/**
 * Dual horizontal bars for one metric (reference: ContrastBar).
 * Values are scaled to [0, amax] for bar width.
 */
export function ContrastBar({ label, a, b, amax, tintA = 'var(--violet)', tintB = 'var(--cyan)' }) {
  const safeMax = amax > 0 ? amax : 1;
  const wA = (Math.min(Math.max(a, 0), safeMax) / safeMax) * 100;
  const wB = (Math.min(Math.max(b, 0), safeMax) / safeMax) * 100;
  return (
    <div>
      <div className="mono" style={{ fontSize: 10, color: 'var(--mut)', letterSpacing: '.14em', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <BarRow letter="A" tint={tintA} value={a} width={wA} />
        <BarRow letter="B" tint={tintB} value={b} width={wB} />
      </div>
    </div>
  );
}
