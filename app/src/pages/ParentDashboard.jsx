import { useAuth } from '../contexts/AuthContext';
import { STUDENTS } from '../config/students';

// Placeholder for the parent dashboard (today-at-a-glance cards, missing work,
// struggle detection — built out in a later phase).
export default function ParentDashboard() {
  const { logout } = useAuth();

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Good morning, Abi</h1>
      <p>Coming next: today-at-a-glance for all four kids, missing work, struggle flags.</p>
      <ul>
        {STUDENTS.map((s) => (
          <li key={s.id}>{s.name} — grade {s.grade}</li>
        ))}
      </ul>
      <button onClick={logout}>Log out</button>
    </div>
  );
}
