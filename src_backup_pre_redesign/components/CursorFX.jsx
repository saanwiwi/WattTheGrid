import { useEffect, useRef } from 'react';

/**
 * CursorFX — High-end creative technology studio cursor system.
 * Features:
 * - Fluid multi-segment trailing ribbon (width scales with cursor velocity)
 * - Velocity-sensitive plasma spark emissions with curl physics
 * - Precision targeting reticle with corner brackets morphing on interactive hover
 * - High-speed click shockwave & particle burst
 * - Crisis mode color shift & electrical jitter
 * Completely non-blocking with pointer-events: none, running 100% in rAF outside React state.
 */
export default function CursorFX({ isCrisis = false }) {
  const canvasRef = useRef(null);
  const s = useRef({
    mouse: { x: -500, y: -500 },
    cursor: { x: -500, y: -500 },
    // 14-point kinematic fluid ribbon chain
    trail: Array.from({ length: 14 }, () => ({ x: -500, y: -500, vx: 0, vy: 0 })),
    vel: { x: 0, y: 0 },
    speed: 0,
    particles: [],
    ripples: [],
    isHovered: false,
    hoverType: '', // 'button', 'node', 'card'
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const onMove = (e) => {
      const st = s.current;
      if (st.mouse.x < -100) {
        st.mouse.x = e.clientX;
        st.mouse.y = e.clientY;
        st.cursor.x = e.clientX;
        st.cursor.y = e.clientY;
        st.trail.forEach((p) => {
          p.x = e.clientX;
          p.y = e.clientY;
        });
        st.speed = 0;
        return;
      }

      const dx = e.clientX - st.mouse.x;
      const dy = e.clientY - st.mouse.y;
      const rawSpeed = Math.hypot(dx, dy);
      st.vel.x = dx;
      st.vel.y = dy;
      st.speed = Math.min(rawSpeed, 25);
      st.mouse.x = e.clientX;
      st.mouse.y = e.clientY;

      // Spawn sparks when moving fast
      if (st.speed > 6) {
        const count = Math.min(3, Math.floor(st.speed / 7));
        for (let i = 0; i < count; i++) {
          const angle = Math.atan2(dy, dx) + Math.PI + (Math.random() - 0.5) * 1.0;
          const spd = Math.random() * (st.speed * 0.15) + 1.0;
          st.particles.push({
            x: e.clientX + (Math.random() - 0.5) * 4,
            y: e.clientY + (Math.random() - 0.5) * 4,
            vx: Math.cos(angle) * spd,
            vy: Math.sin(angle) * spd,
            life: 1.0,
            decay: Math.random() * 0.05 + 0.04,
            size: Math.random() * 1.6 + 0.6,
          });
        }
      }
    };

    const onClick = (e) => {
      const st = s.current;
      // Concentric click ripples
      st.ripples.push({ x: e.clientX, y: e.clientY, r: 0, maxR: 70, life: 1 });
      st.ripples.push({ x: e.clientX, y: e.clientY, r: 0, maxR: 45, life: 1 });

      // Radial click burst sparks
      const burstCount = 20;
      for (let i = 0; i < burstCount; i++) {
        const theta = (Math.PI * 2 * i) / burstCount + (Math.random() - 0.5) * 0.3;
        const speed = Math.random() * 4.5 + 2.0;
        st.particles.push({
          x: e.clientX,
          y: e.clientY,
          vx: Math.cos(theta) * speed,
          vy: Math.sin(theta) * speed,
          life: 1.0,
          decay: Math.random() * 0.035 + 0.025,
          size: Math.random() * 2.5 + 1.2,
        });
      }
    };

    const onOver = (e) => {
      const target = e.target;
      const isBtn = !!target.closest('button, a, [role="button"]');
      const isNode = !!target.closest('.node-breath-yellow, .node-breath-blue, .node-breath-red, .node-breath-white');
      const isCard = !!target.closest('.instrument-cell, [data-interactive="true"]');

      s.current.isHovered = isBtn || isNode || isCard;
      s.current.hoverType = isNode ? 'node' : isBtn ? 'button' : isCard ? 'card' : '';
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('click', onClick);
    window.addEventListener('mouseover', onOver);

    const lerp = (a, b, factor) => a + (b - a) * factor;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const st = s.current;

      const primaryR = isCrisis ? 255 : 255;
      const primaryG = isCrisis ? 42 : 234;
      const primaryB = isCrisis ? 42 : 0;
      const primaryHex = isCrisis ? '#FF2A2A' : '#FFEA00';

      const blueR = 20;
      const blueG = 52;
      const blueB = 251;

      // ── 1. Update Kinematic Fluid Ribbon Trail ─────────────────────
      st.cursor.x = lerp(st.cursor.x, st.mouse.x, 0.35);
      st.cursor.y = lerp(st.cursor.y, st.mouse.y, 0.35);

      st.trail[0].x = st.cursor.x;
      st.trail[0].y = st.cursor.y;

      for (let i = 1; i < st.trail.length; i++) {
        const factor = 0.42 - (i / st.trail.length) * 0.18;
        st.trail[i].x = lerp(st.trail[i].x, st.trail[i - 1].x, factor);
        st.trail[i].y = lerp(st.trail[i].y, st.trail[i - 1].y, factor);
      }

      // Draw fluid ribbon when moving
      if (st.trail.length > 2 && st.speed > 0.8) {
        ctx.save();
        for (let i = 0; i < st.trail.length - 1; i++) {
          const ptA = st.trail[i];
          const ptB = st.trail[i + 1];
          if (ptA.x <= 0 || ptB.x <= 0 || Math.hypot(ptA.x - ptB.x, ptA.y - ptB.y) > 80) continue;

          const progress = 1 - i / st.trail.length;
          const width = Math.min(6, (st.speed * 0.18 + 1.2) * progress);

          ctx.beginPath();
          ctx.moveTo(ptA.x, ptA.y);
          ctx.lineTo(ptB.x, ptB.y);
          ctx.strokeStyle = `rgba(${primaryR}, ${primaryG}, ${primaryB}, ${progress * 0.4})`;
          ctx.lineWidth = Math.max(1, width);
          ctx.lineCap = 'round';
          ctx.stroke();

          // Core bright plasma line inside ribbon
          ctx.beginPath();
          ctx.moveTo(ptA.x, ptA.y);
          ctx.lineTo(ptB.x, ptB.y);
          ctx.strokeStyle = `rgba(255, 255, 255, ${progress * 0.5})`;
          ctx.lineWidth = Math.max(0.5, width * 0.35);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Decay speed smoothly
      st.speed *= 0.88;

      // ── 2. Render Ripples ──────────────────────────────────────────
      st.ripples = st.ripples.filter((r) => r.life > 0.01);
      st.ripples.forEach((r) => {
        r.r += (r.maxR - r.r) * 0.12;
        r.life -= 0.035;

        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${primaryR}, ${primaryG}, ${primaryB}, ${r.life * 0.6})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });

      // ── 3. Render Particles ────────────────────────────────────────
      st.particles = st.particles.filter((p) => p.life > 0.01);
      st.particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.92;
        p.vy *= 0.92;
        p.life -= p.decay;

        const pRad = Math.max(0, p.size * p.life);
        ctx.beginPath();
        ctx.arc(p.x, p.y, pRad, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${primaryR}, ${primaryG}, ${primaryB}, ${p.life * 0.8})`;
        ctx.fill();
      });

      // ── 4. Main Precision Reticle / Morphing Lock Brackets ──────────
      const cx = st.cursor.x;
      const cy = st.cursor.y;

      if (st.isHovered) {
        // Morph into an industrial target bracket [ + ]
        const boxSize = st.hoverType === 'node' ? 24 : 18;
        const bracketLen = 6;

        ctx.save();
        ctx.strokeStyle = primaryHex;
        ctx.lineWidth = 1.5;

        // Top-left bracket
        ctx.beginPath();
        ctx.moveTo(cx - boxSize, cy - boxSize + bracketLen);
        ctx.lineTo(cx - boxSize, cy - boxSize);
        ctx.lineTo(cx - boxSize + bracketLen, cy - boxSize);
        ctx.stroke();

        // Top-right bracket
        ctx.beginPath();
        ctx.moveTo(cx + boxSize - bracketLen, cy - boxSize);
        ctx.lineTo(cx + boxSize, cy - boxSize);
        ctx.lineTo(cx + boxSize, cy - boxSize + bracketLen);
        ctx.stroke();

        // Bottom-left bracket
        ctx.beginPath();
        ctx.moveTo(cx - boxSize, cy + boxSize - bracketLen);
        ctx.lineTo(cx - boxSize, cy + boxSize);
        ctx.lineTo(cx - boxSize + bracketLen, cy + boxSize);
        ctx.stroke();

        // Bottom-right bracket
        ctx.beginPath();
        ctx.moveTo(cx + boxSize - bracketLen, cy + boxSize);
        ctx.lineTo(cx + boxSize, cy + boxSize);
        ctx.lineTo(cx + boxSize, cy + boxSize - bracketLen);
        ctx.stroke();

        // Center target cross
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.fillStyle = primaryHex;
        ctx.fill();

        ctx.restore();
      } else {
        // Standard high-tech reticle: outer ring + crosshair ticks + central dot
        const ringRadius = 14;
        const tickLen = 6;
        const gap = 6;

        // Outer reticle circle
        ctx.beginPath();
        ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${primaryR}, ${primaryG}, ${primaryB}, 0.35)`;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Crosshair ticks
        ctx.strokeStyle = primaryHex;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - ringRadius - tickLen, cy);
        ctx.lineTo(cx - gap, cy);
        ctx.moveTo(cx + gap, cy);
        ctx.lineTo(cx + ringRadius + tickLen, cy);
        ctx.moveTo(cx, cy - ringRadius - tickLen);
        ctx.lineTo(cx, cy - gap);
        ctx.moveTo(cx, cy + gap);
        ctx.lineTo(cx, cy + ringRadius + tickLen);
        ctx.stroke();

        // Central precise dot
        ctx.beginPath();
        ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = primaryHex;
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('click', onClick);
      window.removeEventListener('mouseover', onOver);
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
