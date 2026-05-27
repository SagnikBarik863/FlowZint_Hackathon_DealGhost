'use client';
import { useEffect, useRef } from 'react';

type Blob = {
  cx: number; cy: number;
  rx: number; ry: number;
  xf: number; yf: number;
  xp: number; yp: number;
  rad: number;
  c0: string;
};

const BLOBS: Blob[] = [
  // ── Large chrome liquid pools ─────────────────────────────────────────────
  { cx: .28, cy: .38, rx: .13, ry: .10, xf: .000280, yf: .000190, xp: 0.0, yp: 1.20, rad: .62, c0: 'rgba(130,165,235,0.14)' },
  { cx: .70, cy: .55, rx: .10, ry: .13, xf: .000200, yf: .000310, xp: 2.1, yp: 0.40, rad: .54, c0: 'rgba(155,185,255,0.10)' },
  { cx: .50, cy: .22, rx: .08, ry: .09, xf: .000350, yf: .000240, xp: 3.9, yp: 2.00, rad: .45, c0: 'rgba(85,108,215,0.09)'  },
  { cx: .16, cy: .72, rx: .07, ry: .10, xf: .000180, yf: .000370, xp: 1.0, yp: 3.10, rad: .42, c0: 'rgba(145,168,240,0.11)' },
  { cx: .82, cy: .28, rx: .11, ry: .08, xf: .000240, yf: .000280, xp: 5.0, yp: 1.50, rad: .48, c0: 'rgba(95,125,210,0.10)'  },
  // ── Specular chrome highlights (smaller, brighter) ────────────────────────
  { cx: .38, cy: .42, rx: .05, ry: .04, xf: .000550, yf: .000420, xp: 0.7, yp: 2.30, rad: .19, c0: 'rgba(210,228,255,0.08)' },
  { cx: .63, cy: .67, rx: .04, ry: .05, xf: .000430, yf: .000550, xp: 3.5, yp: 0.90, rad: .16, c0: 'rgba(195,210,255,0.07)' },
  { cx: .56, cy: .68, rx: .09, ry: .06, xf: .000320, yf: .000220, xp: 1.8, yp: 4.00, rad: .34, c0: 'rgba(120,148,222,0.08)' },
];

/**
 * Full-bleed canvas that renders an animated liquid-chrome gradient.
 * Designed as an absolutely-positioned background layer inside a
 * `position: relative; overflow: hidden` parent.
 */
export function LiquidChromeCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;

    let w = 0, h = 0;

    function resize() {
      // 1× resolution is plenty for soft gradient blobs
      w = c!.width  = c!.offsetWidth;
      h = c!.height = c!.offsetHeight;
    }
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(c);

    function draw(t: number) {
      // ── Base dark background ───────────────────────────────────────────────
      ctx!.fillStyle = '#0d1117';
      ctx!.fillRect(0, 0, w, h);

      // ── Chrome liquid blobs ────────────────────────────────────────────────
      for (const b of BLOBS) {
        const bx = w * (b.cx + b.rx * Math.sin(t * b.xf + b.xp));
        const by = h * (b.cy + b.ry * Math.cos(t * b.yf + b.yp));
        const r  = Math.min(w, h) * b.rad;
        const g  = ctx!.createRadialGradient(bx, by, 0, bx, by, r);
        g.addColorStop(0, b.c0);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx!.fillStyle = g;
        ctx!.fillRect(0, 0, w, h);
      }

      // ── Slow metallic horizontal sweep (like light reflecting on chrome) ──
      const sy = h * (0.5 + 0.45 * Math.sin(t * 0.000140));
      const sg = ctx!.createLinearGradient(0, sy - h * 0.12, 0, sy + h * 0.12);
      sg.addColorStop(0,   'rgba(0,0,0,0)');
      sg.addColorStop(0.5, 'rgba(200,218,255,0.024)');
      sg.addColorStop(1,   'rgba(0,0,0,0)');
      ctx!.fillStyle = sg;
      ctx!.fillRect(0, 0, w, h);

      // ── Vignette — darkens edges to focus the chrome glow ─────────────────
      const vg = ctx!.createRadialGradient(w / 2, h / 2, h * 0.15, w / 2, h / 2, h * 0.88);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.52)');
      ctx!.fillStyle = vg;
      ctx!.fillRect(0, 0, w, h);
    }

    let rafId = 0;
    let last  = 0;
    function loop(t: number) {
      // Cap at ~30 fps — blobs move slowly, no need for 60fps
      if (t - last > 33) {
        draw(t);
        last = t;
      }
      rafId = requestAnimationFrame(loop);
    }
    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={ref}
      className="absolute inset-0 w-full h-full"
      aria-hidden="true"
    />
  );
}
