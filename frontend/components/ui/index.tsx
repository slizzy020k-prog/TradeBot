'use client';

import { ReactNode } from 'react';

interface GlassPanelProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  glow?: 'blue' | 'green' | 'red' | 'none';
}

export function GlassPanel({ children, className = '', hover = false, glow = 'none' }: GlassPanelProps) {
  const glowClass = {
    blue: 'hover:shadow-[0_0_30px_rgba(0,212,255,0.15)]',
    green: 'hover:shadow-[0_0_30px_rgba(0,255,136,0.15)]',
    red: 'hover:shadow-[0_0_30px_rgba(255,51,102,0.15)]',
    none: '',
  }[glow];

  return (
    <div
      className={`
        glass-panel
        p-4
        ${hover ? 'card-hover cursor-pointer ' + glowClass : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

interface StatusIndicatorProps {
  status: 'active' | 'warning' | 'error' | 'idle';
  label?: string;
  pulse?: boolean;
}

export function StatusIndicator({ status, label, pulse = false }: StatusIndicatorProps) {
  const statusClasses = {
    active: 'status-dot-active',
    warning: 'status-dot-warning',
    error: 'status-dot-error',
    idle: 'status-dot-idle',
  };

  return (
    <div className="flex items-center gap-2">
      <div className={`status-dot ${statusClasses[status]} ${pulse ? 'animate-pulse' : ''}`} />
      {label && <span className="text-xs text-zinc-400">{label}</span>}
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon?: ReactNode;
}

export function MetricCard({ label, value, subValue, trend, icon }: MetricCardProps) {
  const trendColors = {
    up: 'text-[var(--bullish)]',
    down: 'text-[var(--bearish)]',
    neutral: 'text-zinc-400',
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-zinc-500 uppercase tracking-wider">{label}</span>
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-semibold font-mono">{value}</span>
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
  value: number; // 0-100
  size?: number;
  strokeWidth?: number;
}

export function ConfidenceRing({ value, size = 80, strokeWidth = 6 }: ConfidenceRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;

  const getColor = () => {
    if (value >= 80) return 'var(--bullish)';
    if (value >= 60) return 'var(--accent-teal)';
    if (value >= 40) return 'var(--warning)';
    return 'var(--bearish)';
  };

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      {/* Background circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--panel-border)"
        strokeWidth={strokeWidth}
      />
      {/* Progress circle */}
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
        className="transition-all duration-500"
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
        {Math.round(value)}
      </text>
    </svg>
  );
}

interface TickerProps {
  items: Array<{ symbol: string; price: number; change: number }>;
}

export function Ticker({ items }: TickerProps) {
  // Duplicate items for seamless loop
  const tickerItems = [...items, ...items];

  return (
    <div className="overflow-hidden relative">
      <div className="flex animate-ticker">
        {tickerItems.map((item, i) => (
          <span key={i} className="flex items-center gap-2 px-4 whitespace-nowrap">
            <span className="text-sm font-medium">{item.symbol}</span>
            <span className="font-mono text-sm">${item.price.toFixed(2)}</span>
            <span
              className={`text-xs ${
                item.change >= 0 ? 'text-[var(--bullish)]' : 'text-[var(--bearish)]'
              }`}
            >
              {item.change >= 0 ? '+' : ''}{item.change.toFixed(2)}%
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

interface SectionHeaderProps {
  title: string;
  badge?: string | number;
  action?: ReactNode;
}

export function SectionHeader({ title, badge, action }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">{title}</h3>
        {badge !== undefined && (
          <span className="px-2 py-0.5 text-xs rounded-full bg-[var(--panel)] text-[var(--accent-teal)]">
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
}

export function LoadingSkeleton({ className = '' }: LoadingSkeletonProps) {
  return (
    <div className={`animate-pulse bg-[var(--panel)] rounded ${className}`} />
  );
}

interface EmptyStateProps {
  message: string;
  icon?: ReactNode;
}

export function EmptyState({ message, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8 text-zinc-500">
      {icon}
      <span className="text-sm">{message}</span>
    </div>
  );
}