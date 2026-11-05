import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger';
  size?: 'small' | 'medium';
  icon?: ReactNode;
};

export function Button({ children, variant = 'primary', size = 'medium', icon, className = '', ...props }: Props) {
  return (
    <button className={`button button--${variant} button--${size} ${className}`} {...props}>
      {icon ? <span className="button__icon">{icon}</span> : null}
      {children}
    </button>
  );
}
