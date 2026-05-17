'use client';

import { ReactNode, useEffect, useState } from 'react';

interface GlassPanelProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  glow?: 'blue' | 'green' | 'red' | 'teal' | 'none';
  animated?: boolean;
}

export function GlassPanel({ children, className = '', hover = false, glow = 'none', animated = false }: GlassPanelProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (animated) {
      setIsVisible(true);
    }
  }, [animated]);

  const glowClass = {
    blue: 'hover:shadow-[0_0_30px_rgba(0,212,255,0.2)] hover:border-[var(--accent-blue)]/30',
    green: 'hover:shadow-[0_0_30px_rgba(0,255,136,0.2)] hover:border-[var(--bullish)]/30',
    red: 'hover:shadow-[0_0_30px_rgba(255,51,102,0.2)] hover:border-[var(--bearish)]/30',
    teal: 'hover:shadow-[0_0_30px_rgba(0,255,204,0.2)] hover:border-[var(--accent-teal)]/30',
    none: '',
  }[glow];

  return (
    <div
      className={`
        glass-panel
        p-4
        relative
        overflow-hidden
        ${hover ? 'card-hover cursor-pointer ' + glowClass : ''}
        ${animated && isVisible ? 'animate-fade-in' : ''}
        ${className}
      `}
    >
      {/* Animated border glow effect */}
      {glow !== 'none' && (
        <div
          className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none"
          style={{
            background: `linear-gradient(135deg, transparent 0%, ${
              glow === 'blue' ? 'rgba(0,212,255,0.05)' :
              glow === 'green' ? 'rgba(0,255,136,0.05)' :
              glow === 'red' ? 'rgba(255,51,102,0.05)' :
              'rgba(0,255,204,0.05)'
            } 50%, transparent 100%)`,
          }}
        />
      )}
      {/* Top edge highlight */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--accent-teal)]/20 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-500" />
      {children}
    </div>
  );
}

interface StatusIndicatorProps {
  status: 'active' | 'warning' | 'error' | 'idle';
  label?: string;
  pulse?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function StatusIndicator({ status, label, pulse = false, size = 'md' }: StatusIndicatorProps) {
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  const statusClasses = {
    active: 'bg-[var(--bullish)]',
    warning: 'bg-[var(--warning)]',
    error: 'bg-[var(--bearish)]',
    idle: 'bg-zinc-500',
  };

  const glowClasses = {
    active: 'shadow-[0_0_8px_var(--bullish)]',
    warning: 'shadow-[0_0_8px_var(--warning)]',
    error: 'shadow-[0_0_8px_var(--bearish)]',
    idle: '',
  };

  return (
    <div className="flex items-center gap-2">
      <div
        className={`
          ${sizeClasses[size]} rounded-full ${statusClasses[status]} ${glowClasses[status]}
          ${pulse ? 'animate-pulse-glow' : ''}
        `}
      />
      {label && (
        <span className="text-xs text-zinc-400">{label}</span>
      )}
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon?: ReactNode;
  animated?: boolean;
}

export function MetricCard({ label, value, subValue, trend, icon, animated = false }: MetricCardProps) {
  const [displayValue, setDisplayValue] = useState<string | number>(animated ? '---' : value);

  useEffect(() => {
    if (animated && typeof value === 'number') {
      let start = 0;
      const duration = 1000;
      const startTime = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        start = eased * (value as number);
        setDisplayValue(Math.round(start));

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      requestAnimationFrame(animate);
    } else {
      setDisplayValue(value);
    }
  }, [value, animated]);

  const trendColors = {
    up: 'text-[var(--bullish)] text-glow-bullish',
    down: 'text-[var(--bearish)] text-glow-bearish',
    neutral: 'text-zinc-400',
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-zinc-500 uppercase tracking-wider">{label}</span>
      <div className="flex items-baseline gap-2">
        <span className={`text-xl font-semibold font-mono ${trend ? trendColors[trend] : 'text-white'}`}>
          {displayValue}
        </span>
        {subValue && (
          <span className={`text-sm ${trend ? trendColors[trend] : 'text-zinc-500'}`}>
            {subValue}
          </span>
        )}
        {icon && <span className="text-zinc-400">{icon}</span>}
      </div>
    </div>
  );
}

interface ConfidenceRingProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  animated?: boolean;
}

export function ConfidenceRing({ value, size = 80, strokeWidth = 6, animated = true }: ConfidenceRingProps) {
  const [progress, setProgress] = useState(animated ? 0 : value);

  useEffect(() => {
    if (animated) {
      const timer = setTimeout(() => {
        setProgress(value);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [value, animated]);

  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  const getColor = () => {
    if (progress >= 80) return 'var(--bullish)';
    if (progress >= 60) return 'var(--accent-teal)';
    if (progress >= 40) return 'var(--warning)';
    return 'var(--bearish)';
  };

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      {/* Background circle with gradient */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--panel-border)"
        strokeWidth={strokeWidth}
      />
      {/* Progress circle with glow */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={getColor()}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-1000 ease-out"
        style={{
          filter: `drop-shadow(0 0 8px ${getColor()})`,
        }}
      />
      {/* Center text */}
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="white"
        fontSize="16"
        fontWeight="bold"
        fontFamily="var(--font-jetbrains)"
        transform={`rotate(90 ${size / 2} ${size / 2})`}
      >
        {Math.round(progress)}
      </text>
    </svg>
  );
}

interface TickerProps {
  items: Array<{ symbol: string; price: number; change: number }>;
}

export function Ticker({ items }: TickerProps) {
  const tickerItems = [...items, ...items, ...items, ...items];

  return (
    <div className="overflow-hidden relative">
      <div
        className="flex gap-8"
        style={{
          animation: 'ticker-scroll 60s linear infinite',
          width: 'max-content',
        }}
      >
        {tickerItems.map((item, i) => (
          <span key={i} className="flex items-center gap-3 px-4 whitespace-nowrap">
            <span className="text-sm font-medium text-white">{item.symbol}</span>
            <span className="font-mono text-sm text-zinc-300">${item.price.toFixed(2)}</span>
            <span
              className={`text-xs font-mono ${
                item.change >= 0 ? 'text-[var(--bullish)]' : 'text-[var(--bearish)]'
              }`}
            >
              {item.change >= 0 ? '+' : ''}{item.change.toFixed(2)}%
            </span>
          </span>
        ))}
      </div>
      {/* Fade edges */}
      <div className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-[var(--background)] to-transparent pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-[var(--background)] to-transparent pointer-events-none" />
    </div>
  );
}

interface SectionHeaderProps {
  title: string;
  badge?: string | number;
  action?: ReactNode;
  animated?: boolean;
}

export function SectionHeader({ title, badge, action, animated = true }: SectionHeaderProps) {
  const [visible, setVisible] = useState(!animated);

  useEffect(() => {
    if (animated) {
      const timer = setTimeout(() => setVisible(true), 100);
      return () => clearTimeout(timer);
    }
  }, [animated]);

  return (
    <div className={`flex items-center justify-between mb-4 ${visible ? 'animate-fade-in' : 'opacity-0'}`}>
      <div className="flex items-center gap-3">
        <div className="h-px w-8 bg-gradient-to-r from-[var(--accent-teal)] to-transparent" />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">{title}</h3>
        {badge !== undefined && (
          <span className="px-2 py-0.5 text-xs rounded-full bg-[var(--accent-teal)]/10 text-[var(--accent-teal)] border border-[var(--accent-teal)]/20">
            {badge}
          </span>
        )}
      </div>
      {action}
    </div>
  );
}

interface LoadingSkeletonProps {
  className?: string;
  variant?: 'default' | 'wave' | 'pulse';
}

export function LoadingSkeleton({ className = '', variant = 'pulse' }: LoadingSkeletonProps) {
  const variantClass = {
    default: 'bg-[var(--panel)]',
    wave: 'animate-shimmer bg-gradient-to-r from-[var(--panel)] via-[var(--panel-border)] to-[var(--panel)] bg-[length:200%_100%]',
    pulse: 'animate-pulse bg-[var(--panel)]',
  };

  return <div className={`rounded ${variantClass[variant]} ${className}`} />;
}

interface EmptyStateProps {
  message: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ message, icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-10 text-zinc-500">
      {icon && (
        <div className="text-zinc-600 animate-float">{icon}</div>
      )}
      <span className="text-sm">{message}</span>
      {action}
    </div>
  );
}

interface GlowButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  className?: string;
}

export function GlowButton({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  className = '',
}: GlowButtonProps) {
  const variantClasses = {
    primary: 'bg-gradient-to-r from-[var(--accent-teal)] to-[var(--accent-blue)] text-black hover:shadow-[0_0_30px_rgba(0,255,204,0.4)]',
    secondary: 'bg-[var(--panel)] border border-[var(--panel-border)] text-white hover:border-[var(--accent-teal)]/50 hover:shadow-[0_0_20px_rgba(0,255,204,0.2)]',
    danger: 'bg-gradient-to-r from-[var(--bearish)] to-[#cc2952] text-white hover:shadow-[0_0_30px_rgba(255,51,102,0.4)]',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        rounded-lg font-medium transition-all duration-300
        hover:scale-105 active:scale-95
        disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
        ${className}
      `}
    >
      {children}
    </button>
  );
}

interface AnimatedBorderProps {
  children: ReactNode;
  className?: string;
  color?: 'teal' | 'blue' | 'purple';
}

export function AnimatedBorder({ children, className = '', color = 'teal' }: AnimatedBorderProps) {
  const colorMap = {
    teal: 'from-[var(--accent-teal)] via-[var(--accent-blue)] to-[var(--accent-teal)]',
    blue: 'from-[var(--accent-blue)] via-[var(--accent-cyan)] to-[var(--accent-blue)]',
    purple: 'from-[var(--accent-violet)] via-[var(--accent-purple)] to-[var(--accent-violet)]',
  };

  return (
    <div className={`relative p-[1px] rounded-lg ${className}`}>
      <div
        className={`absolute inset-0 rounded-lg bg-gradient-to-r ${colorMap[color]} bg-[length:200%_100%] animate-[border-rotate_3s_linear infinite]`}
        style={{ filter: 'blur(0px)' }}
      />
      <div className="relative bg-[var(--panel)] rounded-lg z-10">{children}</div>
    </div>
  );
}