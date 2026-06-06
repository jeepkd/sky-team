import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
}

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  const base = 'rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-cockpit-accent disabled:opacity-50';
  const variants = {
    primary: 'bg-cockpit-accent text-black hover:brightness-110',
    secondary: 'border border-cockpit-border bg-transparent text-gray-300 hover:bg-cockpit-border',
  };
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}
