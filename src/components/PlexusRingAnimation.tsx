import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AppTheme, THEME_OPTIONS, ThemeOption } from '../utils/themeHelper';

interface PlexusRingAnimationProps {
  modelName?: string;
  theme?: AppTheme;
  compact?: boolean;
  fill?: boolean;
  showLabel?: boolean;
}

interface Particle {
  angle: number;
  angularVelocity: number;
  baseRadius: number;
  radiusOffset: number;
  radialFrequency: number;
  radialAmplitude: number;
  phase: number;
  z: number;
  zVelocity: number;
  size: number;
  type: 'triangle' | 'dot' | 'bright_dot';
  triangleAngle: number;
  triangleRotSpeed: number;
  color: string;
  alpha: number;
}

export const PlexusRingAnimation: React.FC<PlexusRingAnimationProps> = ({
  modelName = 'qwen3-0.6b',
  theme = 'crimson',
  compact = false,
  fill = false,
  showLabel = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const mousePosRef = useRef<{ x: number; y: number; active: boolean }>({ x: 0, y: 0, active: false });
  const [activeTheme, setActiveTheme] = useState<AppTheme>(theme);

  useEffect(() => {
    setActiveTheme(theme);
  }, [theme]);

  const currentThemeOption = THEME_OPTIONS.find((t) => t.id === activeTheme) || THEME_OPTIONS[0];

  const initParticles = useCallback((width: number, height: number): Particle[] => {
    const particles: Particle[] = [];
    const count = Math.min(Math.floor((width * height) / (compact || fill ? 2800 : 4500)), compact || fill ? 90 : 160);
    const minDim = Math.min(width, height);
    
    // Scale ring radius based on container size
    const minRadius = compact || fill ? Math.min(minDim * 0.32, 48) : 110;
    const baseRingRadius = Math.max(minDim * 0.28, minRadius);
    const ringThickness = Math.max(minDim * 0.12, compact || fill ? 18 : 45);

    const greenColors = ['#4ADE80', '#22C55E', '#86EFAC', '#84CC16', '#65A30D'];
    const crimsonColors = ['#DC143C', '#FF4D6D', '#FF758F', '#C70039', '#FF85A1'];
    const cyanColors = ['#06B6D4', '#22D3EE', '#67E8F9', '#3B82F6', '#60A5FA'];
    const amberColors = ['#F59E0B', '#FBBF24', '#FCD34D', '#D97706', '#F97316'];
    const purpleColors = ['#A855F7', '#C084FC', '#D8B4FE', '#9333EA', '#E879F9'];
    const monochromeColors = ['#F8FAFC', '#E2E8F0', '#CBD5E1', '#94A3B8', '#64748B'];

    const themePaletteMap: Record<AppTheme, string[]> = {
      emerald: greenColors,
      crimson: crimsonColors,
      cyan: cyanColors,
      amber: amberColors,
      purple: purpleColors,
      monochrome: monochromeColors,
    };

    const palette = themePaletteMap[activeTheme] || crimsonColors;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
      const radiusOffset = (Math.random() - 0.5) * ringThickness * 2;
      const isTriangle = Math.random() < 0.24;
      const isBrightDot = !isTriangle && Math.random() < 0.35;

      particles.push({
        angle,
        angularVelocity: (Math.random() * 0.003 + 0.0015) * (Math.random() < 0.2 ? -1 : 1),
        baseRadius: baseRingRadius,
        radiusOffset,
        radialFrequency: Math.random() * 0.02 + 0.008,
        radialAmplitude: Math.random() * 18 + 6,
        phase: Math.random() * Math.PI * 2,
        z: (Math.random() - 0.5) * 60,
        zVelocity: (Math.random() - 0.5) * 0.15,
        size: isTriangle ? Math.random() * 3 + 3.5 : isBrightDot ? Math.random() * 1.8 + 2.0 : Math.random() * 1.2 + 1.0,
        type: isTriangle ? 'triangle' : isBrightDot ? 'bright_dot' : 'dot',
        triangleAngle: Math.random() * Math.PI * 2,
        triangleRotSpeed: (Math.random() - 0.5) * 0.03,
        color: isTriangle || isBrightDot ? palette[Math.floor(Math.random() * palette.length)] : '#E2E8F0',
        alpha: isTriangle ? Math.random() * 0.4 + 0.6 : isBrightDot ? Math.random() * 0.3 + 0.6 : Math.random() * 0.3 + 0.25,
      });
    }

    return particles;
  }, [activeTheme, compact, fill]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let particles: Particle[] = [];
    let time = 0;

    const handleResize = () => {
      if (!container || !canvas) return;
      const rect = container.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.scale(dpr, dpr);
      particles = initParticles(width, height);
    };

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(container);
    handleResize();

    // Render loop
    const render = () => {
      time += 1;
      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      const maxConnectDistance = Math.min(width, height) * 0.11; // connection distance threshold

      // Parallax offset from mouse
      let targetOffsetX = 0;
      let targetOffsetY = 0;
      if (mousePosRef.current.active) {
        targetOffsetX = (mousePosRef.current.x - centerX) * 0.04;
        targetOffsetY = (mousePosRef.current.y - centerY) * 0.04;
      }

      // Draw subtle background center glow
      const glowGrad = ctx.createRadialGradient(
        centerX + targetOffsetX,
        centerY + targetOffsetY,
        20,
        centerX + targetOffsetX,
        centerY + targetOffsetY,
        Math.min(width, height) * 0.42
      );

      const themeGlowColor = `rgba(${currentThemeOption.rgb}, 0.08)`;

      glowGrad.addColorStop(0, themeGlowColor);
      glowGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0.01)');
      glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, 0, width, height);

      // Compute particle 2D coordinates for this frame
      const coords: { x: number; y: number; z: number; p: Particle }[] = [];

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Orbit update
        p.angle += p.angularVelocity;
        p.triangleAngle += p.triangleRotSpeed;
        p.phase += p.radialFrequency;
        p.z += p.zVelocity;

        if (p.z > 35 || p.z < -35) {
          p.zVelocity *= -1;
        }

        // Radial breathing motion
        const r = p.baseRadius + p.radiusOffset + Math.sin(p.phase) * p.radialAmplitude;

        // 3D perspective projection factor
        const fov = 350;
        const scale = fov / (fov + p.z);

        const px = centerX + targetOffsetX + Math.cos(p.angle) * r * scale;
        const py = centerY + targetOffsetY + Math.sin(p.angle) * r * scale;

        coords.push({ x: px, y: py, z: p.z, p });
      }

      // Draw connecting lines between close particles
      ctx.lineWidth = 0.8;
      for (let i = 0; i < coords.length; i++) {
        const c1 = coords[i];
        for (let j = i + 1; j < coords.length; j++) {
          const c2 = coords[j];
          const dx = c1.x - c2.x;
          const dy = c1.y - c2.y;
          const distSq = dx * dx + dy * dy;

          if (distSq < maxConnectDistance * maxConnectDistance) {
            const dist = Math.sqrt(distSq);
            const normDist = 1 - dist / maxConnectDistance;
            const lineAlpha = normDist * normDist * 0.32 * Math.min(c1.p.alpha, c2.p.alpha);

            ctx.beginPath();
            ctx.moveTo(c1.x, c1.y);
            ctx.lineTo(c2.x, c2.y);

            // If one of the endpoints is a colored triangle, give the line a subtle tint
            if (c1.p.type === 'triangle' || c2.p.type === 'triangle') {
              ctx.strokeStyle = `rgba(${currentThemeOption.rgb}, ${lineAlpha * 1.4})`;
            } else {
              ctx.strokeStyle = `rgba(180, 190, 205, ${lineAlpha})`;
            }
            ctx.stroke();
          }
        }
      }

      // Draw particles & triangles on top
      for (let i = 0; i < coords.length; i++) {
        const { x, y, z, p } = coords[i];
        const fov = 350;
        const scale = fov / (fov + z);
        const curSize = p.size * scale;
        const curAlpha = Math.max(0.1, Math.min(1, p.alpha * (scale * 0.9)));

        if (p.type === 'triangle') {
          // Render oriented triangle
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(p.triangleAngle);

          ctx.fillStyle = p.color;
          ctx.globalAlpha = curAlpha;

          const triRadius = curSize * 1.4;
          ctx.beginPath();
          ctx.moveTo(0, -triRadius);
          ctx.lineTo(triRadius * 0.866, triRadius * 0.6);
          ctx.lineTo(-triRadius * 0.866, triRadius * 0.6);
          ctx.closePath();
          ctx.fill();

          // Subtle glow around triangle
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 6;
          ctx.fill();
          ctx.shadowBlur = 0;

          ctx.restore();
        } else if (p.type === 'bright_dot') {
          // Colored glowing dot
          ctx.beginPath();
          ctx.arc(x, y, curSize, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = curAlpha;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 5;
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 1;
        } else {
          // Neutral white/grey node
          ctx.beginPath();
          ctx.arc(x, y, curSize, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(220, 230, 245, ${curAlpha})`;
          ctx.fill();
        }
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      resizeObserver.disconnect();
    };
  }, [initParticles, activeTheme, currentThemeOption]);

  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    mousePosRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      active: true,
    };
  };

  const handleMouseLeave = () => {
    mousePosRef.current.active = false;
  };

  return (
    <div
      className={`flex flex-col items-center justify-center select-none ${
        fill
          ? 'absolute inset-0 w-full h-full pointer-events-none'
          : compact
            ? 'relative w-full min-h-0 py-1 flex-1'
            : 'relative w-full flex-1 min-h-[360px] py-4'
      }`}
    >
      <div
        ref={containerRef}
        onMouseMove={fill ? undefined : handleMouseMove}
        onMouseLeave={fill ? undefined : handleMouseLeave}
        className={`relative w-full flex items-center justify-center overflow-hidden ${
          fill
            ? 'h-full max-w-none pointer-events-none'
            : compact
              ? 'h-full min-h-[160px] flex-1 max-w-2xl cursor-default'
              : 'h-[320px] sm:h-[380px] max-w-2xl cursor-default'
        }`}
      >
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 w-full h-full ${fill ? 'pointer-events-none' : 'pointer-events-auto'}`}
        />

        {showLabel && (
          <div className="relative z-10 flex flex-col items-center justify-center text-center px-4 pointer-events-none">
            <h1
              className={`font-bold font-sans tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)] ${
                compact || fill ? 'text-base' : 'text-2xl sm:text-3xl md:text-4xl'
              }`}
            >
              {modelName}
            </h1>
          </div>
        )}
      </div>
    </div>
  );
};
