import { useEffect, useRef } from 'react';

/**
 * GridAmbient — Living architectural canvas environment.
 * Features:
 * - Interactive warped vector grid responding to cursor proximity & velocity
 * - Click shockwave rings that physically displace grid nodes & particles
 * - Faint technical schematics & power distribution diagrams etched into the dark canvas
 * - Coordinate indices & crosshair ticks
 * - Magnetic ambient drift particles with fluid drag & crisis acceleration
 * - Ultra-thin slow scanning telemetry sweep
 * Runs 100% in requestAnimationFrame outside React state with pointer-events: none.
 */
export default function GridAmbient({ isCrisis = false }) {
  const canvasRef = useRef(null);
  const stateRef = useRef({
    mouse: { x: -2000, y: -2000, prevX: -2000, prevY: -2000, speed: 0 },
    shockwaves: [],
    particles: [],
    t: 0,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf;

    const GRID = 50;

    const initParticles = () => {
      stateRef.current.particles = Array.from({ length: 42 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        baseR: Math.random() * 1.4 + 0.4,
        phase: Math.random() * Math.PI * 2,
        kind: Math.random() > 0.65 ? 'blue' : Math.random() > 0.35 ? 'yellow' : 'white',
      }));
    };

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      if (stateRef.current.particles.length === 0) initParticles();
    };
    resize();
    window.addEventListener('resize', resize);

    const onMove = (e) => {
      const s = stateRef.current;
      const dx = e.clientX - s.mouse.prevX;
      const dy = e.clientY - s.mouse.prevY;
      s.mouse.speed = Math.hypot(dx, dy);
      s.mouse.prevX = s.mouse.x;
      s.mouse.prevY = s.mouse.y;
      s.mouse.x = e.clientX;
      s.mouse.y = e.clientY;
    };

    const onClick = (e) => {
      // Add a physical shockwave that displaces the ambient grid
      stateRef.current.shockwaves.push({
        x: e.clientX,
        y: e.clientY,
        radius: 5,
        maxRadius: 280,
        strength: 28,
        life: 1.0,
      });
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('click', onClick);

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const s = stateRef.current;
      const speedMult = isCrisis ? 2.5 : 1.0;
      s.t += 0.008 * speedMult;

      const mx = s.mouse.x;
      const my = s.mouse.y;

      const primaryR = isCrisis ? 255 : 20;
      const primaryG = isCrisis ? 42 : 52;
      const primaryB = isCrisis ? 42 : 251;

      const accentR = isCrisis ? 255 : 255;
      const accentG = isCrisis ? 42 : 234;
      const accentB = isCrisis ? 42 : 0;

      // Update shockwaves
      s.shockwaves = s.shockwaves.filter((w) => w.life > 0.01);
      s.shockwaves.forEach((w) => {
        w.radius += (w.maxRadius - w.radius) * 0.08;
        w.life *= 0.94;
      });

      // ── 1. Faint Technical Schematics & Watermarks (Parallax Layer) ─
      ctx.save();
      const parallaxX = (mx / canvas.width - 0.5) * 12;
      const parallaxY = (my / canvas.height - 0.5) * 12;
      ctx.translate(parallaxX, parallaxY);

      // Large faint schematic concentric arcs in the center-right
      ctx.strokeStyle = `rgba(${primaryR}, ${primaryG}, ${primaryB}, 0.04)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(canvas.width * 0.65, canvas.height * 0.45, 240, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(canvas.width * 0.65, canvas.height * 0.45, 360, 0, Math.PI * 2);
      ctx.setLineDash([8, 16]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Faint diagonal technical transmission vector lines
      ctx.strokeStyle = `rgba(255, 255, 255, 0.025)`;
      ctx.beginPath();
      ctx.moveTo(canvas.width * 0.35, 0);
      ctx.lineTo(canvas.width * 0.35 + 400, canvas.height);
      ctx.moveTo(canvas.width * 0.5, 0);
      ctx.lineTo(canvas.width * 0.5 + 400, canvas.height);
      ctx.stroke();

      ctx.restore();

      // ── 2. Interactive Warping Vector Grid ───────────────────────────
      const cols = Math.ceil(canvas.width / GRID) + 1;
      const rows = Math.ceil(canvas.height / GRID) + 1;

      // Displacement function for any grid point (px, py)
      const getDisplacedPoint = (px, py) => {
        let dx = px - mx;
        let dy = py - my;
        const dist = Math.hypot(dx, dy);
        let dispX = 0;
        let dispY = 0;

        // Cursor proximity displacement
        const warpRadius = 140;
        if (dist < warpRadius && dist > 1) {
          const force = (1 - dist / warpRadius) * 16;
          dispX += (dx / dist) * force;
          dispY += (dy / dist) * force;
        }

        // Shockwave displacement
        s.shockwaves.forEach((w) => {
          const wdx = px - w.x;
          const wdy = py - w.y;
          const wdist = Math.hypot(wdx, wdy);
          const waveDist = Math.abs(wdist - w.radius);
          if (waveDist < 45 && wdist > 1) {
            const wForce = (1 - waveDist / 45) * w.strength * w.life;
            dispX += (wdx / wdist) * wForce;
            dispY += (wdy / wdist) * wForce;
          }
        });

        return { x: px + dispX, y: py + dispY, dist };
      };

      // Draw horizontal grid lines with warp
      ctx.lineWidth = 0.75;
      for (let j = 0; j <= rows; j++) {
        const gy = j * GRID;
        ctx.beginPath();
        for (let i = 0; i <= cols; i++) {
          const pt = getDisplacedPoint(i * GRID, gy);
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
        ctx.stroke();
      }

      // Draw vertical grid lines with warp
      for (let i = 0; i <= cols; i++) {
        const gx = i * GRID;
        ctx.beginPath();
        for (let j = 0; j <= rows; j++) {
          const pt = getDisplacedPoint(gx, j * GRID);
          if (j === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
        ctx.stroke();
      }

      // Draw grid intersection ticks & active proximity points
      for (let i = 0; i <= cols; i++) {
        for (let j = 0; j <= rows; j++) {
          const gx = i * GRID;
          const gy = j * GRID;
          const pt = getDisplacedPoint(gx, gy);

          if (pt.dist < 130) {
            // Brightened intersection point near cursor
            const prox = 1 - pt.dist / 130;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, prox * 2.2 + 0.8, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${accentR}, ${accentG}, ${accentB}, ${prox * 0.75})`;
            ctx.fill();

            // Small crosshair tick
            const tick = 3;
            ctx.strokeStyle = `rgba(${accentR}, ${accentG}, ${accentB}, ${prox * 0.4})`;
            ctx.beginPath();
            ctx.moveTo(pt.x - tick, pt.y);
            ctx.lineTo(pt.x + tick, pt.y);
            ctx.moveTo(pt.x, pt.y - tick);
            ctx.lineTo(pt.x, pt.y + tick);
            ctx.stroke();
          } else if (i % 3 === 0 && j % 3 === 0) {
            // Faint ambient crosshair at major intersections
            const tick = 2;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.beginPath();
            ctx.moveTo(pt.x - tick, pt.y);
            ctx.lineTo(pt.x + tick, pt.y);
            ctx.moveTo(pt.x, pt.y - tick);
            ctx.lineTo(pt.x, pt.y + tick);
            ctx.stroke();
          }
        }
      }

      // ── 3. Faint Coordinates at Sector Intervals ─────────────────────
      ctx.font = '7px "JetBrains Mono", monospace';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      for (let i = 2; i < cols; i += 6) {
        for (let j = 2; j < rows; j += 6) {
          const pt = getDisplacedPoint(i * GRID, j * GRID);
          ctx.fillText(`+${(i * 10).toString(16).toUpperCase()}:${(j * 10).toString(16).toUpperCase()}`, pt.x + 4, pt.y - 4);
        }
      }

      // ── 4. Shockwave Ripple Rings on Click ───────────────────────────
      s.shockwaves.forEach((w) => {
        ctx.beginPath();
        ctx.arc(w.x, w.y, w.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${accentR}, ${accentG}, ${accentB}, ${w.life * 0.45})`;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(w.x, w.y, Math.max(0, w.radius - 20), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${primaryR}, ${primaryG}, ${primaryB}, ${w.life * 0.25})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      // ── 5. Radial Glow Following Cursor ─────────────────────────────
      if (mx > -1000) {
        const grd = ctx.createRadialGradient(mx, my, 0, mx, my, 220);
        grd.addColorStop(0, `rgba(${primaryR}, ${primaryG}, ${primaryB}, ${isCrisis ? 0.08 : 0.055})`);
        grd.addColorStop(0.5, `rgba(${accentR}, ${accentG}, ${accentB}, 0.02)`);
        grd.addColorStop(1, 'transparent');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(mx, my, 220, 0, Math.PI * 2);
        ctx.fill();
      }

      // ── 6. Ambient Drifting Magnetic Particles ───────────────────────
      s.particles.forEach((p) => {
        // Particles get pulled slightly into cursor wake
        const pdx = mx - p.x;
        const pdy = my - p.y;
        const pdist = Math.hypot(pdx, pdy);
        if (pdist < 180 && pdist > 5) {
          const pForce = (1 - pdist / 180) * 0.4;
          p.vx += (pdx / pdist) * pForce;
          p.vy += (pdy / pdist) * pForce;
        }

        // Apply friction
        p.vx *= 0.96;
        p.vy *= 0.96;

        p.x += p.vx * speedMult;
        p.y += p.vy * speedMult;

        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        const pulse = (Math.sin(s.t * 1.5 + p.phase) + 1) * 0.5;
        const alpha = (0.08 + pulse * 0.2) * (isCrisis ? 1.6 : 1.0);

        let pr = 255,
          pg = 255,
          pb = 255;
        if (isCrisis) {
          pr = 255;
          pg = Math.random() > 0.5 ? 42 : 120;
          pb = 42;
        } else if (p.kind === 'yellow') {
          pr = 255;
          pg = 234;
          pb = 0;
        } else if (p.kind === 'blue') {
          pr = 20;
          pg = 52;
          pb = 251;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.baseR * (isCrisis ? 1.3 : 1), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${pr}, ${pg}, ${pb}, ${alpha})`;
        ctx.fill();
      });

      // ── 7. Slow Telemetry Scan Sweep Line ────────────────────────────
      const scanY = ((s.t * 40) % (canvas.height + 80)) - 40;
      const sg = ctx.createLinearGradient(0, scanY - 20, 0, scanY + 20);
      sg.addColorStop(0, 'transparent');
      sg.addColorStop(0.5, `rgba(${accentR}, ${accentG}, ${accentB}, ${isCrisis ? 0.025 : 0.015})`);
      sg.addColorStop(1, 'transparent');
      ctx.fillStyle = sg;
      ctx.fillRect(0, scanY - 20, canvas.width, 40);

      raf = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('click', onClick);
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
