import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { useAuth } from '@/features/auth/auth-context';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger';
  size?: 'small' | 'medium';
  icon?: ReactNode;
  permission?: readonly [method: string, path: string];
};

export function Button({ children, variant = 'primary', size = 'medium', icon, className = '', permission, ...props }: Props) {
  const { can } = useAuth();
  if (permission && !can(...permission)) return null;
  return (
    <button className={`button button--${variant} button--${size} ${className}`} {...props}>
      {icon ? <span className="button__icon">{icon}</span> : null}
      {children}
    </button>
  );
}
