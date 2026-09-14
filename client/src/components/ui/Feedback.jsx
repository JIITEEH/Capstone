import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';

const ALERT_ICONS = { error: CircleAlert, warning: TriangleAlert, info: Info, success: CircleCheck };

export function Alert({ tone = 'error', title, children, action }) {
  const Icon = ALERT_ICONS[tone];
  return (
    <div className={`alert alert-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon size={18} className="alert-icon" />
      <div className="alert-body">
        {title && <strong>{title}</strong>}
        {children && <div>{children}</div>}
      </div>
      {action}
    </div>
  );
}

export function Spinner({ size = 20 }) {
  return <span className="spinner" style={{ width: size, height: size }} role="status" aria-label="Loading" />;
}

export function PageLoader({ fullscreen = false }) {
  return (
    <div className={`page-loader${fullscreen ? ' fullscreen' : ''}`}>
      <Spinner size={28} />
    </div>
  );
}

export function EmptyState({ icon: Icon, title, message, action, compact = false }) {
  return (
    <div className={`empty-state${compact ? ' compact' : ''}`}>
      {Icon && (
        <div className="empty-icon">
          <Icon size={compact ? 20 : 24} />
        </div>
      )}
      <strong>{title}</strong>
      {message && <p>{message}</p>}
      {action}
    </div>
  );
}

// Shows a spinner on first load, an error if loading failed, otherwise nothing
export function LoadState({ loading, error }) {
  if (error) return <Alert title="Something went wrong">{error}</Alert>;
  if (loading) return <PageLoader />;
  return null;
}
