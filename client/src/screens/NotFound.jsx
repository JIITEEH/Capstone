import { Link } from 'react-router';
import { Compass } from 'lucide-react';
import { EmptyState } from '../ui-pieces/basics/Feedback.jsx';

export default function NotFound() {
  return (
    <section className="card">
      <EmptyState
        icon={Compass}
        title="Page not found"
        message="The page you're looking for doesn't exist or you don't have access to it."
        action={
          <Link to="/" className="btn btn-primary">
            Back to dashboard
          </Link>
        }
      />
    </section>
  );
}
