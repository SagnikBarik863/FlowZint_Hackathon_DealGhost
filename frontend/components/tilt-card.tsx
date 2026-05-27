'use client';
import { useRef, MouseEvent, ReactNode } from 'react';

interface TiltCardProps {
  children: ReactNode;
  className?: string;
  /** Maximum tilt angle in degrees (default 10) */
  intensity?: number;
}

/**
 * A card that tilts in 3-D towards the cursor and shows a chrome-style
 * radial shine that follows the pointer position.
 *
 * Usage:
 *   <TiltCard className="p-5 rounded-xl border ...">…content…</TiltCard>
 *
 * The component merges its own inline styles (position, overflow, transition,
 * will-change) with the className you pass. Keep `position: relative` or
 * `relative` in your className — the inline style already sets it, so
 * Tailwind's `relative` is not strictly required but harmless to include.
 */
export function TiltCard({ children, className = '', intensity = 10 }: TiltCardProps) {
  const cardRef  = useRef<HTMLDivElement>(null);
  const shineRef = useRef<HTMLDivElement>(null);

  function onMouseMove(e: MouseEvent<HTMLDivElement>) {
    const el = cardRef.current;
    const sh = shineRef.current;
    if (!el || !sh) return;

    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width  - 0.5;  // -0.5 … +0.5
    const y = (e.clientY - rect.top)  / rect.height - 0.5;

    // 3-D tilt + subtle scale-up
    el.style.transform = `perspective(900px) rotateX(${y * -intensity}deg) rotateY(${x * intensity}deg) scale3d(1.03,1.03,1.03)`;

    // Dynamic shadow depth — deeper when tilted away
    el.style.boxShadow = [
      `0 ${12 + y * 18}px 36px rgba(40,90,230,0.14)`,
      `0 0 16px rgba(70,120,255,0.08)`,
      `inset 0 0 0 1px rgba(120,160,255,0.06)`,
    ].join(', ');

    // Chrome shine — radial gradient following cursor
    sh.style.background = `radial-gradient(circle at ${(x + 0.5) * 100}% ${(y + 0.5) * 100}%, rgba(180,210,255,0.15) 0%, rgba(100,150,255,0.04) 45%, transparent 70%)`;
    sh.style.opacity = '1';
  }

  function onMouseLeave() {
    const el = cardRef.current;
    const sh = shineRef.current;
    if (!el || !sh) return;
    el.style.transform  = '';
    el.style.boxShadow  = '';
    sh.style.opacity    = '0';
  }

  return (
    <div
      ref={cardRef}
      className={className}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      style={{
        position:   'relative',
        overflow:   'hidden',
        transition: 'transform 0.18s ease, box-shadow 0.20s ease',
        willChange: 'transform',
      }}
    >
      {/* Chrome shine overlay — pointer-events none so it never blocks clicks */}
      <div
        ref={shineRef}
        aria-hidden="true"
        style={{
          position:      'absolute',
          inset:          0,
          opacity:        0,
          pointerEvents: 'none',
          transition:    'opacity 0.22s ease',
          zIndex:         2,
        }}
      />
      {children}
    </div>
  );
}
