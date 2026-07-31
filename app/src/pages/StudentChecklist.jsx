import { useAuth } from '../contexts/AuthContext';

// Placeholder for the linear daily checklist (built out in the next phase —
// today's assignments, one active item at a time, PDF viewer, submission forms).
export default function StudentChecklist() {
  const { studentId, logout } = useAuth();

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>Today's checklist — {studentId}</h1>
      <p>Coming next: today's assignment list, one item at a time.</p>
      <button onClick={logout}>Log out</button>
    </div>
  );
}
