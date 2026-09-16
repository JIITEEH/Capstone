import { Component } from 'react';
import { Link } from 'react-router';
import { TriangleAlert } from 'lucide-react';
import { EmptyState } from './Feedback.jsx';

// Catches a crash while rendering a page so the rest of the app stays usable. React only reports
// these to a class component, which is why this one isn't a function like everything else.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error('Page crashed:', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <section className="card">
        <EmptyState
          icon={TriangleAlert}
          title="Something went wrong on this page"
          message="The rest of ThesisTrack still works. Reload to try again, or go back to your dashboard."
          action={
            <div className="empty-actions">
              <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
                Reload page
              </button>
              <Link to="/" className="btn btn-secondary">
                Back to dashboard
              </Link>
            </div>
          }
        />
      </section>
    );
  }
}
