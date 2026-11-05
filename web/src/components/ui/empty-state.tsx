import type { ReactNode } from 'react';
import { Icon, type IconName } from './icon';

export function EmptyState({ icon = 'clipboard', title, description, action }: {
  icon?: IconName;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon"><Icon name={icon} size={23} /></div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
