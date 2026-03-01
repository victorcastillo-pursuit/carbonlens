import React from 'react';

interface CardProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  headerRight?: React.ReactNode;
}

export function Card({ title, subtitle, children, className = '', headerRight }: CardProps) {
  return (
    <div className={`bg-white border border-neutral-200 rounded-lg shadow-sm ${className}`}>
      {(title || subtitle) && (
        <div className="flex items-start justify-between px-6 py-4 border-b border-neutral-100">
          <div>
            {title && (
              <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wide">{title}</h3>
            )}
            {subtitle && (
              <p className="mt-0.5 text-xs text-neutral-500">{subtitle}</p>
            )}
          </div>
          {headerRight && <div>{headerRight}</div>}
        </div>
      )}
      <div className="px-6 py-4">{children}</div>
    </div>
  );
}
