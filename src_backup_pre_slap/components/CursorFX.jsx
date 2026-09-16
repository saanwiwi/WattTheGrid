import { useEffect, useRef } from 'react';

/**
 * CursorFX — Custom canvas cursor system.
 * Runs entirely outside React state using refs.
 * pointer-events: none — never blocks clicks.
 */
export default function CursorFX({ isCrisis }) {
  const canvasRef = useRef(null);
  // All mutable cursor state lives in a ref to avoid re-renders
  const s = useRef({
    mouse:    { x: -500, y: -500 },
    cursor:   { x: -500, y: -500 }, // fast follower
    ring:     { x: -500, y: -500 }, // medium follower
    blob:     { x: -500, y: -500 }, // slow trailing blob
    vel:      { x: 0, y: 0 },
    speed:    0,
    particles: [],
    ripples:   [],
    isBtn:     false,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const onMove = (e) => {
      const st = s.current;
      st.vel.x   = e.clientX - st.mouse.x;
      st.vel.y   = e.clientY - st.mouse.y;
      st.speed   = Math.hypot(st.vel.x, st.vel.y);
      st.mouse.x = e.clientX;
      st.mouse.y = e.clientY;

      if (st.speed > 4) {
        const n = Math.min(5, Math.ceil(st.speed / 7));
        for (let i = 0; i < n; i++) {
          st.particles.push({
            x:    st.mouse.x + (Math.random() - 0.5) * 6,
            y:    st.mouse.y + (Math.random() - 0.5) * 6,
            vx:  -st.vel.x * (0.04 + Math.random() * 0.06) + (Math.random() - 0.5) * 1.2,
            vy:  -st.vel.y * (0.04 + Math.random() * 0.06) + (Math.random() - 0.5) * 1.2,
            life: 0.75 + Math.random() * 0.25,
            r:    Math.random() * 2 + 0.5,
          });
        }
      }
    };

    const onClick = (e) => {
      const st = s.current;
      st.ripples.push({ x: e.clientX, y: e.clientY, r: 0, life: 1 });
      // radial burst on click
      for (let i = 0; i < 14; i++) {
        const a = (Math.PI * 2 * i) / 14;
        const spd = 2.5 + Math.random() * 3;
        st.particles.push({
          x: e.clientX, y: e.clientY,
          vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
          life: 0.6 + Math.random() * 0.4,
          r: Math.random() * 2 + 1,
        });
      }
    };

    const onOver = (e) => {
      s.current.isBtn = !!e.target.closest('button, a, [role="button"]');
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('click', onClick);
    document.addEventListener('mouseover', onOver);

    const lerp = (a, b, t) => a + (b - a) * t;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const st = s.current;

      // — Lerp positions at different speeds —
      st.cursor.x = lerp(st.cursor.x, st.mouse.x, 0.22);
      st.cursor.y = lerp(st.cursor.y, st.mouse.y, 0.22);
      st.ring.x   = lerp(st.ring.x,   st.mouse.x, 0.10);
      st.ring.y   = lerp(st.ring.y,   st.mouse.y, 0.10);
      st.blob.x   = lerp(st.blob.x,   st.mouse.x, 0.05);
      st.blob.y   = lerp(st.blob.y,   st.mouse.y, 0.05);

      const cr = isCrisis ? '255,42,42'  : '255,234,0';
      const cs = isCrisis ? '#FF2A2A'    : '#FFEA00';

      // — Ripples —
      st.ripples = st.ripples.filter(r => r.life > 0);
      st.ripples.forEach(r => {
        r.r   += (60 - r.r) * 0.14;
        r.life -= 0.032;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${cr},${r.life * 0.55})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r * 0.4, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${cr},${r.life * 0.25})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      // — Trail particles —
      st.particles = st.particles.filter(p => p.life > 0);
      st.particles.forEach(p => {
        p.x    += p.vx;
        p.y    += p.vy;
        p.vx   *= 0.91;
        p.vy   *= 0.91;
        p.life -= 0.032;
        const rad = Math.max(0, p.r * p.life);
        ctx.beginPath();
        ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${cr},${p.life * 0.65})`;
        ctx.fill();
      });

      // — Trailing blob (stretches with velocity direction) —
      const bDist  = Math.hypot(st.blob.x - st.cursor.x, st.blob.y - st.cursor.y);
      const bAngle = Math.atan2(st.blob.y - st.cursor.y, st.blob.x - st.cursor.x);
      const bW     = (st.isBtn ? 24 : 16) + bDist * 0.45;
      const bH     = Math.max(7, (st.isBtn ? 18 : 11) - bDist * 0.15);

      ctx.save();
      ctx.translate(st.blob.x, st.blob.y);
      ctx.rotate(bAngle + Math.PI);
      ctx.beginPath();
      ctx.ellipse(0, 0, bW, bH, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${cr},0.055)`;
      ctx.fill();
      ctx.restore();

      // — Outer ring (medium follow) —
      const rR = st.isBtn ? 22 : 13;
      ctx.beginPath();
      ctx.arc(st.ring.x, st.ring.y, rR, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${cr},0.45)`;
      ctx.lineWidth = 1;
      ctx.stroke();

      // — Main dot (fast follow) —
      ctx.beginPath();
      ctx.arc(st.cursor.x, st.cursor.y, st.isBtn ? 4.5 : 2.5, 0, Math.PI * 2);
      ctx.fillStyle = cs;
      ctx.fill();

      // — Crosshair ticks (only when not hovering a button) —
      if (!st.isBtn) {
        const gap  = 8;
        const tick = 5;
        ctx.strokeStyle = `rgba(${cr},0.45)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(st.cursor.x - gap - tick, st.cursor.y);
        ctx.lineTo(st.cursor.x - gap,        st.cursor.y);
        ctx.moveTo(st.cursor.x + gap,        st.cursor.y);
        ctx.lineTo(st.cursor.x + gap + tick, st.cursor.y);
        ctx.moveTo(st.cursor.x, st.cursor.y - gap - tick);
        ctx.lineTo(st.cursor.x, st.cursor.y - gap);
        ctx.moveTo(st.cursor.x, st.cursor.y + gap);
        ctx.lineTo(st.cursor.x, st.cursor.y + gap + tick);
        ctx.stroke();
      }

      raf = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('click', onClick);
      document.removeEventListener('mouseover', onOver);
    };
  }, [isCrisis]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    />
  );
}
