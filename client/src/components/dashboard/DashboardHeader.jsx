export default function DashboardHeader({ subtitle, children }) {
  return (
    <div className="dash-header">
      <div>
        <h1>Dashboard</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children && <div className="dash-actions">{children}</div>}
    </div>
  );
}
