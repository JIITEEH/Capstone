import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useAuth } from '../../shared-state/AuthContext.jsx';
import { api, tokenStore } from '../../api-client/api.js';
import { Spinner } from '../../ui-pieces/basics/Feedback.jsx';
import AuthLayout from './AuthLayout.jsx';

// Opened from the link in the verification email. Works whether or not the student is signed in.
export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const { setUser } = useAuth();
  const [state, setState] = useState(token ? 'verifying' : 'failed');
  const [message, setMessage] = useState(token ? '' : 'This link is missing its code. Copy the whole link from the email.');
  const used = useRef(false);
  const signedIn = Boolean(tokenStore.get());

  useEffect(() => {
    // The link works once, and React runs effects twice in development. Only the first run may use it,
    // or the second would report a failure for a link that just worked.
    if (!token || used.current) return;
    used.current = true;

    (async () => {
      try {
        const result = await api.verifyEmail(token);
        setMessage(result.message);
        setState('verified');
        // Refresh the signed-in account so pages stop asking for verification without a reload
        if (tokenStore.get()) {
          try {
            const { user } = await api.me();
            setUser(user);
          } catch {
            // Not signed in on this device; the verification still counts
          }
        }
      } catch (err) {
        setMessage(err.message);
        setState('failed');
      }
    })();
  }, [token, setUser]);

  if (state === 'verifying') {
    return (
      <AuthLayout>
        <h1>Verifying your email</h1>
        <div className="notif-loading">
          <Spinner />
        </div>
      </AuthLayout>
    );
  }

  if (state === 'verified') {
    return (
      <AuthLayout>
        <h1>Email verified</h1>
        <p className="muted">{message} You can now start a thesis or be added to a group.</p>
        <Link to={signedIn ? '/thesis' : '/login'} className="btn btn-primary btn-block">
          {signedIn ? 'Go to my thesis' : 'Sign in'}
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h1>This link didn&apos;t work</h1>
      <p className="muted">{message}</p>
      <p className="muted">
        {signedIn
          ? 'Open your thesis page and choose "Send a new link".'
          : 'Sign in, then open your thesis page and choose "Send a new link".'}
      </p>
      <Link to={signedIn ? '/thesis' : '/login'} className="btn btn-primary btn-block">
        {signedIn ? 'Go to my thesis' : 'Sign in'}
      </Link>
    </AuthLayout>
  );
}
