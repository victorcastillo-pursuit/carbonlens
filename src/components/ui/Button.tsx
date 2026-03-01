import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: React.ReactNode;
}

const variantClasses: Record<string, string> = {
  primary:   'bg-blue-600 text-white hover:bg-blue-700 border-transparent disabled:bg-blue-300',
  secondary: 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50 disabled:text-neutral-300',
  danger:    'bg-red-600 text-white hover:bg-red-700 border-transparent disabled:bg-red-300',
  ghost:     'bg-transparent text-blue-600 border-transparent hover:bg-blue-50 disabled:text-blue-300',
};

const sizeClasses: Record<string, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-2.5 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={[
        'inline-flex items-center gap-2 font-medium rounded-md border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1',
        variantClasses[variant],
        sizeClasses[size],
        (disabled || loading) ? 'cursor-not-allowed' : 'cursor-pointer',
        className,
      ].join(' ')}
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  );
}
