import { useEffect, useRef } from 'react';

/**
 * GridAmbient — Canvas background layer.
 * Draws: interactive grid dots, radial cursor glow, ambient drift particles, scan sweep.
 * pointer-events: none, z-index: 1 (behind UI at z-index: 2).
 */
export default function GridAmbient({ isCrisis }) {
  const canvasRef = useRef(null);
  const mouseRef  = useRef({ x: -2000, y: -2000 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf;
    let t = 0;
    let particles = [];

    const GRID = 40;

    const initParticles = () => {
      particles = Array.from({ length: 28 }, () => ({
        x:     Math.random() * canvas.width,
        y:     Math.random() * canvas.height,
        vx:    (Math.random() - 0.5) * 0.22,
        vy:    (Math.random() - 0.5) * 0.22,
        r:     Math.random() * 1.1 + 0.3,
        phase: Math.random() * Math.PI * 2,
        kind:  Math.random() > 0.65 ? 'blue' : Math.random() > 0.5 ? 'yellow' : 'white',
      }));
    };

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      initParticles();
    };
    resize();
    window.addEventListener('resize', resize);

    const onMove = (e) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
    };
    document.addEventListener('mousemove', onMove);

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      t += 0.007;

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      // Choose accent channel based on crisis state
      const ar = isCrisis ? 255 : 255;
      const ag = isCrisis ?  42 : 234;
      const ab = isCrisis ?  42 :   0;

      // — Interactive grid dot field —
      const cols = Math.ceil(canvas.width  / GRID) + 1;
      const rows = Math.ceil(canvas.height / GRID) + 1;

      for (let i = 0; i <= cols; i++) {
        for (let j = 0; j <= rows; j++) {
          const gx   = i * GRID;
          const gy   = j * GRID;
          const dist = Math.hypot(mx - gx, my - gy);
          const prox = Math.max(0, 1 - dist / 150);

          if (prox > 0.005) {
            // Brightened dot near cursor
            ctx.beginPath();
            ctx.arc(gx, gy, prox * 2.2 + 0.4, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${ar},${ag},${ab},${prox * 0.72})`;
            ctx.fill();
          } else {
            // Ambient dim dot
            ctx.beginPath();
            ctx.arc(gx, gy, 0.5, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,0.045)';
            ctx.fill();
          }
        }
      }

      // — Soft radial glow following cursor —
      if (mx > -1000) {
        const grd = ctx.createRadialGradient(mx, my, 0, mx, my, 170);
        grd.addColorStop(0, `rgba(${ar},${ag},${ab},0.045)`);
        grd.addColorStop(1, 'transparent');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(mx, my, 170, 0, Math.PI * 2);
        ctx.fill();
      }

      // — Ambient drifting particles —
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0)             p.x = canvas.width;
        if (p.x > canvas.width)  p.x = 0;
        if (p.y < 0)             p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        const pulse = (Math.sin(t * 1.4 + p.phase) + 1) * 0.5;
        const alpha = 0.05 + pulse * 0.10;

        let pr = 255, pg = 255, pb = 255;
        if (p.kind === 'yellow') { pr = 255; pg = 234; pb = 0; }
        else if (p.kind === 'blue') { pr = 20; pg = 52; pb = 251; }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${pr},${pg},${pb},${alpha})`;
        ctx.fill();
      });

      // — Slow scan-line sweep —
      const scanY = ((t * 35) % (canvas.height + 60)) - 30;
      const sg = ctx.createLinearGradient(0, scanY - 18, 0, scanY + 18);
      sg.addColorStop(0, 'transparent');
      sg.addColorStop(0.5, `rgba(${ar},${ag},${ab},0.010)`);
      sg.addColorStop(1, 'transparent');
      ctx.fillStyle = sg;
      ctx.fillRect(0, scanY - 18, canvas.width, 36);

      raf = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      document.removeEventListener('mousemove', onMove);
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
        zIndex: 1,
      }}
    />
  );
}
