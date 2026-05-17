'use client';

import { useState, useEffect, useRef } from 'react';

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}

export function AnimatedNumber({
  value,
  duration = 1000,
  prefix = '',
  suffix = '',
  decimals = 2,
  className = '',
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const previousValue = useRef(0);
  const animationRef = useRef<number | undefined>(undefined);
  const startTimeRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const startValue = previousValue.current;
    const difference = value - startValue;

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = startValue + difference * easeOut;

      setDisplayValue(current);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        previousValue.current = value;
        startTimeRef.current = undefined;
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value, duration]);

  return (
    <span className={`font-mono ${className}`}>
      {prefix}{displayValue.toFixed(decimals)}{suffix}
    </span>
  );
}

interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  showValue?: boolean;
  color?: 'teal' | 'blue' | 'purple' | 'bullish' | 'bearish';
  animated?: boolean;
  className?: string;
}

export function ProgressBar({
  value,
  max = 100,
  label,
  showValue = true,
  color = 'teal',
  animated = true,
  className = '',
}: ProgressBarProps) {
  const [width, setWidth] = useState(animated ? 0 : (value / max) * 100);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    if (animated && !hasAnimated) {
      const timer = setTimeout(() => {
        setWidth((value / max) * 100);
        setHasAnimated(true);
      }, 100);
      return () => clearTimeout(timer);
    } else if (!animated) {
      setWidth((value / max) * 100);
    }
  }, [value, max, animated, hasAnimated]);

  const colorClasses = {
    teal: 'bg-gradient-to-r from-[var(--accent-teal)] to-[var(--accent-cyan)]',
    blue: 'bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-cyan)]',
    purple: 'bg-gradient-to-r from-[var(--accent-violet)] to-[var(--accent-purple)]',
    bullish: 'bg-gradient-to-r from-[var(--bullish)] to-[#00cc6a]',
    bearish: 'bg-gradient-to-r from-[var(--bearish)] to-[#cc2952]',
  };

  const glowClasses = {
    teal: 'shadow-[0_0_10px_rgba(0,255,204,0.5)]',
    blue: 'shadow-[0_0_10px_rgba(0,212,255,0.5)]',
    purple: 'shadow-[0_0_10px_rgba(168,85,247,0.5)]',
    bullish: 'shadow-[0_0_10px_rgba(0,255,136,0.5)]',
    bearish: 'shadow-[0_0_10px_rgba(255,51,102,0.5)]',
  };

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-zinc-400 uppercase tracking-wider">{label}</span>
          {showValue && (
            <span className="text-xs font-mono text-[var(--accent-teal)]">
              {value.toFixed(0)}/{max}
            </span>
          )}
        </div>
      )}
      <div className="h-2 bg-[var(--background-secondary)] rounded-full overflow-hidden border border-[var(--panel-border)]">
        <div
          className={`h-full ${colorClasses[color]} ${glowClasses[color]} rounded-full transition-all duration-1000 ease-out`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

interface CircularProgressProps {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  color?: 'teal' | 'blue' | 'purple' | 'bullish' | 'bearish';
  animated?: boolean;
  className?: string;
}

export function CircularProgress({
  value,
  max = 100,
  size = 120,
  strokeWidth = 8,
  label,
  color = 'teal',
  animated = true,
  className = '',
}: CircularProgressProps) {
  const [progress, setProgress] = useState(animated ? 0 : value / max);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    if (animated && !hasAnimated) {
      const timer = setTimeout(() => {
        setProgress(value / max);
        setHasAnimated(true);
      }, 100);
      return () => clearTimeout(timer);
    } else if (!animated) {
      setProgress(value / max);
    }
  }, [value, max, animated, hasAnimated]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  const colorMap = {
    teal: 'var(--accent-teal)',
    blue: 'var(--accent-blue)',
    purple: 'var(--accent-violet)',
    bullish: 'var(--bullish)',
    bearish: 'var(--bearish)',
  };

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--panel-border)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colorMap[color]}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-1000 ease-out"
          style={{
            filter: `drop-shadow(0 0 6px ${colorMap[color]})`,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold font-mono text-white">
          {Math.round((progress * max))}
        </span>
        {label && <span className="text-xs text-zinc-400">{label}</span>}
      </div>
    </div>
  );
}

interface PulsingDotProps {
  color?: 'teal' | 'blue' | 'purple' | 'bullish' | 'bearish';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function PulsingDot({
  color = 'teal',
  size = 'md',
  className = '',
}: PulsingDotProps) {
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  const colorClasses = {
    teal: 'bg-[var(--accent-teal)] shadow-[0_0_8px_var(--accent-teal)]',
    blue: 'bg-[var(--accent-blue)] shadow-[0_0_8px_var(--accent-blue)]',
    purple: 'bg-[var(--accent-purple)] shadow-[0_0_8px_var(--accent-purple)]',
    bullish: 'bg-[var(--bullish)] shadow-[0_0_8px_var(--bullish)]',
    bearish: 'bg-[var(--bearish)] shadow-[0_0_8px_var(--bearish)]',
  };

  return (
    <div className={`relative ${className}`}>
      <div className={`${sizeClasses[size]} rounded-full ${colorClasses[color]} animate-pulse-glow`} />
    </div>
  );
}

interface GlowingBorderProps {
  children: React.ReactNode;
  color?: 'teal' | 'blue' | 'purple';
  intensity?: 'low' | 'medium' | 'high';
  className?: string;
}

export function GlowingBorder({
  children,
  color = 'teal',
  intensity = 'medium',
  className = '',
}: GlowingBorderProps) {
  const intensityMap = {
    low: '0 0 10px',
    medium: '0 0 20px',
    high: '0 0 40px',
  };

  const colorMap = {
    teal: 'var(--accent-teal)',
    blue: 'var(--accent-blue)',
    purple: 'var(--accent-purple)',
  };

  return (
    <div
      className={`rounded-lg p-[1px] bg-gradient-to-r from-transparent via-${color}-500 to-transparent ${className}`}
      style={{
        background: `linear-gradient(135deg, ${colorMap[color]}00, ${colorMap[color]}80, ${colorMap[color]}00)`,
        boxShadow: intensityMap[intensity] + ' ' + colorMap[color] + '40',
      }}
    >
      <div className="bg-[var(--panel)] rounded-lg h-full">{children}</div>
    </div>
  );
}