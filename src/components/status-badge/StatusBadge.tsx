export type StatusType = 'loading' | 'success' | 'error' | '';

interface StatusBadgeProps {
  type?: StatusType;
  children?: React.ReactNode;
  className?: string;
}

export function StatusBadge({ type, children, className = '' }: StatusBadgeProps) {
  const classes = `status-badge${type ? ` status-${type}` : ''}${className ? ` ${className}` : ''}`;

  return <span className={classes}>{children}</span>;
}
