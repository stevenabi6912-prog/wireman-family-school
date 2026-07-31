import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// Gates a route by role. This is a UX convenience only — the real access
// control is Firestore/Storage security rules, which don't trust the client.
export default function RequireRole({ role, children }) {
  const { user, role: currentRole, loading } = useAuth();

  if (loading) return <div className="loading-screen">Loading…</div>;
  if (!user) return <Navigate to="/" replace />;
  if (role && currentRole !== role) {
    return <Navigate to={currentRole === 'parent' ? '/dashboard' : '/today'} replace />;
  }
  return children;
}
