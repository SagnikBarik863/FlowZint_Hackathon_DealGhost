'use client';

import { useEffect, useRef } from 'react';

// ── Config ───────────────────────────────────────────────────────────────────

const N = 82;          // particle count
const CONNECT = 0.52;  // 3-D connection distance threshold
const FOV = 2.6;       // perspective factor
const BOUND = 1.18;    // bounce boundary

interface P3 {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  r: number;
  h: number; // hue (210–250 = blue → indigo)
}

// ── 3-D rotation helpers ─────────────────────────────────────────────────────

function rx3(x: number, y: number, z: number, a: number) {
  const c = Math.cos(a), s = Math.sin(a);
  return [x, y * c - z * s, y * s + z * c] as const;
}
function ry3(x: number, y: number, z: number, a: number) {
  const c = Math.cos(a), s = Math.sin(a);
  return [x * c + z * s, y, -x * s + z * c] as const;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function HeroCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    let W = 0, H = 0;
    let raf = 0, prev = 0;
    // rotation state — rX/rY are actual; tX/tY are targets (from mouse); spinY auto-increments
    let rX = 0, rY = 0, tX = 0, tY = 0, spinY = 0;

    // ── Particles ───────────────────────────────────────────────────────────
    const pts: P3[] = Array.from({ length: N }, () => ({
      x:  (Math.random() - 0.5) * 2.2,
      y:  (Math.random() - 0.5) * 2.2,
      z:  (Math.random() - 0.5) * 2.2,
      vx: (Math.random() - 0.5) * 0.00055,
      vy: (Math.random() - 0.5) * 0.00055,
      vz: (Math.random() - 0.5) * 0.00055,
      r:  0.9 + Math.random() * 1.6,
      h:  212 + Math.random() * 38,
    }));

    // ── Resize ───────────────────────────────────────────────────────────────
    function resize() {
      const dpr = Math.min(window.devicePixelRatio ?? 1, 2);
      W = canvas!.offsetWidth;
      H = canvas!.offsetHeight;
      canvas!.width  = W * dpr;
      canvas!.height = H * dpr;
      // setTransform is safe to call repeatedly — resets any previous scale
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // ── Mouse parallax ───────────────────────────────────────────────────────
    function onMouseMove(e: MouseEvent) {
      tX = -((e.clientY / window.innerHeight) - 0.5) * 0.46;
      tY =  ((e.clientX / window.innerWidth)  - 0.5) * 0.46;
    }

    // ── Render ───────────────────────────────────────────────────────────────
    type PP = { sx: number; sy: number; sc: number; dz: number; p: P3 };

    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(now - prev, 48); // cap dt so a tab-switch doesn't teleport particles
      prev = now;

      // Ease rotation
      spinY += dt * 0.000048;
      rX += (tX - rX)          * 0.032;
      rY += (tY + spinY - rY)  * 0.022;

      // ── Background ─────────────────────────────────────────────────────
      ctx.fillStyle = '#0d1117';
      ctx.fillRect(0, 0, W, H);

      // Subtle deep-blue nebula bloom at center
      const amb = ctx.createRadialGradient(W * 0.5, H * 0.5, 0, W * 0.5, H * 0.5, H * 0.65);
      amb.addColorStop(0,   'rgba(23,37,90,0.22)');
      amb.addColorStop(0.5, 'rgba(23,37,90,0.06)');
      amb.addColorStop(1,   'rgba(13,17,23,0)');
      ctx.fillStyle = amb;
      ctx.fillRect(0, 0, W, H);

      // ── Project particles ───────────────────────────────────────────────
      const pp: PP[] = pts.map((p) => {
        // Drift
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        // Bounce
        if (Math.abs(p.x) > BOUND) p.vx = -p.vx;
        if (Math.abs(p.y) > BOUND) p.vy = -p.vy;
        if (Math.abs(p.z) > BOUND) p.vz = -p.vz;

        // Rotate
        let [rx, ry, rz] = rx3(p.x, p.y, p.z, rX);
        [rx, ry, rz]     = ry3(rx, ry, rz, rY);

        // Perspective project
        const sc = FOV / (FOV + rz + 2.1);
        return {
          sx: W * 0.5 + rx * sc * W * 0.41,
          sy: H * 0.5 + ry * sc * H * 0.41,
          sc,
          dz: rz,
          p,
        };
      });

      // ── Connections ─────────────────────────────────────────────────────
      for (let i = 0; i < pp.length; i++) {
        for (let j = i + 1; j < pp.length; j++) {
          const a = pp[i], b = pp[j];
          // Distance in original 3-D space (rotation preserves distances)
          const dx = a.p.x - b.p.x;
          const dy = a.p.y - b.p.y;
          const dz = a.p.z - b.p.z;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 > CONNECT * CONNECT) continue;

          const ratio  = 1 - Math.sqrt(d2) / CONNECT;
          const depthA = Math.max(0, (a.dz + 2.6) / 4.2);
          const depthB = Math.max(0, (b.dz + 2.6) / 4.2);
          const alpha  = ratio * ratio * 0.65 * Math.min(depthA, depthB);

          ctx.beginPath();
          ctx.moveTo(a.sx, a.sy);
          ctx.lineTo(b.sx, b.sy);
          ctx.strokeStyle = `rgba(96,165,250,${Math.min(0.75, alpha).toFixed(2)})`;
          ctx.lineWidth   = ratio * 1.4;
          ctx.stroke();
        }
      }

      // ── Dots (back → front for correct depth ordering) ──────────────────
      pp.sort((a, b) => a.dz - b.dz).forEach(({ sx, sy, sc, dz, p }) => {
        const depth = Math.max(0.06, Math.min(1, (dz + 2.6) / 4.2));
        const rad   = p.r * sc * 3.8;

        const grd = ctx.createRadialGradient(sx, sy, 0, sx, sy, rad * 3);
        grd.addColorStop(0,   `hsla(${p.h},92%,74%,${depth.toFixed(2)})`);
        grd.addColorStop(0.38,`hsla(${p.h},82%,58%,${(depth * 0.42).toFixed(2)})`);
        grd.addColorStop(1,   `hsla(${p.h},70%,38%,0)`);

        ctx.beginPath();
        ctx.arc(sx, sy, rad * 3, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();
      });

      // ── Edge vignette — blends into page bg ─────────────────────────────
      const vg = ctx.createRadialGradient(W * 0.5, H * 0.5, H * 0.18, W * 0.5, H * 0.5, H * 0.95);
      vg.addColorStop(0, 'rgba(13,17,23,0)');
      vg.addColorStop(1, 'rgba(13,17,23,0.90)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
    }

    // ── Boot ────────────────────────────────────────────────────────────────
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    window.addEventListener('mousemove', onMouseMove);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('mousemove', onMouseMove);
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
