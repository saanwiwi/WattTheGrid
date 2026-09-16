import { useEffect, useRef } from 'react';

/**
 * EnergyField — Physical electromagnetic energy field behind the hero kW number.
 * Renders rotating calibration reticles, harmonic contour flux rings that scale
 * and distort with live load, orbiting field particles, and magnetic cursor deflection.
 * Runs 100% in requestAnimationFrame with pointer-events: none.
 */
export default function EnergyField({ load = 120, isCrisis = false }) {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: -2000, y: -2000, active: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf;
    let t = 0;

    // Orbiting field particles
    const PARTICLE_COUNT = 36;
    const particles = Array.from({ length: PARTICLE_COUNT }, () => ({
      angle: Math.random() * Math.PI * 2,
      dist: Math.random() * 120 + 80,
      speed: (Math.random() * 0.015 + 0.008) * (Math.random() > 0.5 ? 1 : -1),
      radius: Math.random() * 1.5 + 0.5,
      alpha: Math.random() * 0.6 + 0.2,
      phase: Math.random() * Math.PI * 2,
    }));

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };
    resize();
    window.addEventListener('resize', resize);

    const onMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      if (
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      ) {
        mouseRef.current.x = e.clientX - rect.left;
        mouseRef.current.y = e.clientY - rect.top;
        mouseRef.current.active = true;
      } else {
        mouseRef.current.active = false;
      }
    };
    window.addEventListener('mousemove', onMove);

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const cx = canvas.width / 2;
      const cy = canvas.height / 2 + 10;
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const hasMouse = mouseRef.current.active;

      // Rate of animation accelerates during crisis or high load
      const loadRatio = Math.min(1.2, Math.max(0.2, load / 400));
      const speedMult = isCrisis ? 2.4 : 1.0 + (loadRatio - 0.3) * 0.8;
      t += 0.012 * speedMult;

      // Color scheme based on crisis / critical load
      const isOverload = load > 410 || isCrisis;
      const primaryR = isOverload ? 255 : 20;
      const primaryG = isOverload ? 42 : 52;
      const primaryB = isOverload ? 42 : 251;

      const accentR = isOverload ? 255 : 255;
      const accentG = isOverload ? 42 : 234;
      const accentB = isOverload ? 42 : 0;

      // Magnetic center offset by mouse proximity
      let targetCenterX = cx;
      let targetCenterY = cy;
      if (hasMouse) {
        targetCenterX += (mx - cx) * 0.12;
        targetCenterY += (my - cy) * 0.12;
      }

      ctx.save();
      ctx.translate(targetCenterX, targetCenterY);

      // ── 1. Concentric Calibration & Degree Reticles ────────────────
      const baseRadius = Math.min(cx, cy) * 0.68;

      // Outer dashed calibration ring (slowly rotating counter-clockwise)
      ctx.save();
      ctx.rotate(-t * 0.15);
      ctx.beginPath();
      ctx.arc(0, 0, baseRadius + 30, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${primaryR}, ${primaryG}, ${primaryB}, ${isOverload ? 0.35 : 0.14})`;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 8, 12, 8]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Degree tick marks at 30° intervals
      for (let i = 0; i < 12; i++) {
        const rad = (i * Math.PI) / 6;
        const x1 = Math.cos(rad) * (baseRadius + 24);
        const y1 = Math.sin(rad) * (baseRadius + 24);
        const x2 = Math.cos(rad) * (baseRadius + 36);
        const y2 = Math.sin(rad) * (baseRadius + 36);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = `rgba(${accentR}, ${accentG}, ${accentB}, ${i % 3 === 0 ? 0.45 : 0.18})`;
        ctx.lineWidth = i % 3 === 0 ? 1.5 : 1;
        ctx.stroke();
      }
      ctx.restore();

      // Middle precision reticle (clockwise)
      ctx.save();
      ctx.rotate(t * 0.22);
      ctx.beginPath();
      ctx.arc(0, 0, baseRadius - 15, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 255, 255, ${isOverload ? 0.25 : 0.08})`;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 6]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Compass quad crosshair ticks
      for (let i = 0; i < 4; i++) {
        const rad = (i * Math.PI) / 2;
        const x1 = Math.cos(rad) * (baseRadius - 35);
        const y1 = Math.sin(rad) * (baseRadius - 35);
        const x2 = Math.cos(rad) * (baseRadius + 5);
        const y2 = Math.sin(rad) * (baseRadius + 5);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = `rgba(${accentR}, ${accentG}, ${accentB}, 0.3)`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.restore();

      // ── 2. Dynamic Harmonic Contour Flux Lines ─────────────────────
      // Harmonic rings whose shape modulates with real-time load
      const contourRings = [
        { radiusScale: 0.85, harmonics: 4, amp: isOverload ? 18 : 7, phase: 0 },
        { radiusScale: 0.65, harmonics: 6, amp: isOverload ? 14 : 5, phase: Math.PI / 3 },
        { radiusScale: 0.45, harmonics: 5, amp: isOverload ? 10 : 3.5, phase: Math.PI / 2 },
      ];

      contourRings.forEach((c, idx) => {
        const ringR = baseRadius * c.radiusScale;
        ctx.beginPath();
        const steps = 100;
        for (let s = 0; s <= steps; s++) {
          const theta = (s / steps) * Math.PI * 2;
          // Perlin-style sinusoidal harmonic perturbation
          const harmonic =
            Math.sin(theta * c.harmonics + t * (idx % 2 === 0 ? 1 : -1) + c.phase) *
            Math.cos(theta * 2 - t * 0.5);
          const r = ringR + harmonic * c.amp;
          const px = Math.cos(theta) * r;
          const py = Math.sin(theta) * r;
          if (s === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.strokeStyle = `rgba(${idx === 0 ? primaryR : accentR}, ${idx === 0 ? primaryG : accentG}, ${idx === 0 ? primaryB : accentB}, ${isOverload ? 0.4 : 0.16})`;
        ctx.lineWidth = isOverload ? 1.8 : 1.2;
        ctx.stroke();
      });

      // ── 3. Orbiting Plasma & Energy Field Particles ─────────────────
      particles.forEach((p) => {
        p.angle += p.speed * speedMult;
        const currentDist = p.dist * (1 + Math.sin(t + p.phase) * 0.15) * (baseRadius / 140);
        const px = Math.cos(p.angle) * currentDist;
        const py = Math.sin(p.angle) * currentDist;

        // Particle trail arc
        const trailAngle = p.angle - p.speed * 4;
        const tx = Math.cos(trailAngle) * currentDist;
        const ty = Math.sin(trailAngle) * currentDist;

        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(px, py);
        ctx.strokeStyle = `rgba(${accentR}, ${accentG}, ${accentB}, ${p.alpha * 0.3})`;
        ctx.lineWidth = p.radius;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(px, py, p.radius * (isOverload ? 1.5 : 1), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${isOverload ? 255 : 255}, ${isOverload ? 80 : 255}, ${isOverload ? 80 : 255}, ${p.alpha})`;
        ctx.fill();
      });

      ctx.restore();

      // ── 4. Technical Field Markings (Center Corner Reticles) ────────
      ctx.save();
      const margin = 24;
      const cornerLen = 14;

      // Top-Left corner reticle
      ctx.strokeStyle = `rgba(255, 255, 255, 0.15)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(margin, margin + cornerLen);
      ctx.lineTo(margin, margin);
      ctx.lineTo(margin + cornerLen, margin);
      ctx.stroke();

      // Top-Right corner reticle
      ctx.beginPath();
      ctx.moveTo(canvas.width - margin - cornerLen, margin);
      ctx.lineTo(canvas.width - margin, margin);
      ctx.lineTo(canvas.width - margin, margin + cornerLen);
      ctx.stroke();

      // Bottom-Left corner reticle
      ctx.beginPath();
      ctx.moveTo(margin, canvas.height - margin - cornerLen);
      ctx.lineTo(margin, canvas.height - margin);
      ctx.lineTo(margin + cornerLen, canvas.height - margin);
      ctx.stroke();

      // Bottom-Right corner reticle
      ctx.beginPath();
      ctx.moveTo(canvas.width - margin - cornerLen, canvas.height - margin);
      ctx.lineTo(canvas.width - margin, canvas.height - margin);
      ctx.lineTo(canvas.width - margin, canvas.height - margin - cornerLen);
      ctx.stroke();

      // Micro Field Readout Faint Text in corners (positioned cleanly below header)
      ctx.font = '8px "JetBrains Mono", monospace';
      ctx.fillStyle = `rgba(255, 255, 255, ${isOverload ? 0.5 : 0.22})`;
      ctx.fillText(`FLUX: ${(load * 1.84).toFixed(1)} G`, margin + 6, margin + 50);
      ctx.fillText(`HARMONIC: ${isOverload ? 'ERR_THD_HIGH' : 'THD 1.08%'}`, margin + 6, margin + 62);

      const rightText = `FIELD_STATE // ${isOverload ? 'OVERLOAD' : 'NOMINAL'}`;
      const textWidth = ctx.measureText(rightText).width;
      ctx.fillStyle = isOverload ? 'rgba(255, 42, 42, 0.7)' : 'rgba(255, 234, 0, 0.45)';
      ctx.fillText(rightText, canvas.width - margin - textWidth - 6, margin + 50);

      ctx.restore();

      raf = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMove);
    };
  }, [load, isCrisis]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 1 }}
    />
  );
}
