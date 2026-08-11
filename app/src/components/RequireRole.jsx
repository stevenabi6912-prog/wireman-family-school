import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// Gates a route by role. This is a UX convenience only — the real access
// control is Firestore/Storage security rules, which don't trust the client.
export default function RequireRole({ role, children }) {
  const { user, role: currentRole, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="loading-screen">Loading…</div>;
  // Remember where they were headed — email links land here when the session
  // has expired, and the PIN screen sends them on afterwards.
  if (!user) {
    return (
      <Navigate to="/" replace state={{ from: location.pathname + location.search + location.hash }} />
    );
  }
  if (role && currentRole !== role) {
    return <Navigate to={currentRole === 'parent' ? '/dashboard' : '/today'} replace />;
  }
  return children;
}
