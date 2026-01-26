export type StatusType = 'loading' | 'success' | 'error' | '';

interface StatusBadgeProps {
  type?: StatusType;
  children?: React.ReactNode;
  className?: string;
  'data-testid'?: string;
  id?: string;
}

export function StatusBadge({ type, children, className = '', 'data-testid': dataTestId, id }: StatusBadgeProps) {
  const classes = `status-badge${type ? ` status-${type}` : ''}${className ? ` ${className}` : ''}`;

  return <span className={classes} data-testid={dataTestId} id={id}>{children}</span>;
}
