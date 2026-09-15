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

// Shimmering placeholder shaped like a typical page while data loads
export function SkeletonPage() {
  return (
    <div className="skeleton-page" aria-busy="true" aria-label="Loading">
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-text" />
      <div className="skeleton-grid">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton skeleton-card" />
        ))}
      </div>
      <div className="skeleton skeleton-block" />
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

// Shows a skeleton on first load, an error if loading failed, otherwise nothing
export function LoadState({ loading, error, onRetry }) {
  if (error) {
    return (
      <Alert
        title="Something went wrong"
        action={
          onRetry && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => onRetry()}>
              Try again
            </button>
          )
        }
      >
        {error}
      </Alert>
    );
  }
  if (loading) return <SkeletonPage />;
  return null;
}
