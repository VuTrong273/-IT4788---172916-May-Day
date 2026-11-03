import type { InputHTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from './icon';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  icon?: IconName;
  trailingAction?: ReactNode;
};

export function TextField({ label, error, icon, trailingAction, id, ...inputProps }: Props) {
  const inputId = id ?? inputProps.name;
  return (
    <label className={`field${error ? ' field--error' : ''}`} htmlFor={inputId}>
      <span className="field__label">{label}</span>
      <span className="field__control">
        {icon ? <Icon name={icon} size={18} className="field__icon" /> : null}
        <input id={inputId} {...inputProps} />
        {trailingAction ? <span className="field__action">{trailingAction}</span> : null}
      </span>
      {error ? <span className="field__error" role="alert">{error}</span> : null}
    </label>
  );
}
