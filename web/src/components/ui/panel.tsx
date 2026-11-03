import type { PropsWithChildren, ReactNode } from 'react';

export function Panel({ title, action, children, className = '' }: PropsWithChildren<{
  title?: string;
  action?: ReactNode;
  className?: string;
}>) {
  return (
    <section className={`panel ${className}`}>
      {title || action ? <div className="panel__header">{title ? <h2>{title}</h2> : <span />}{action}</div> : null}
      {children}
    </section>
  );
}
