import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import RequireRole from './components/RequireRole';
import Login from './pages/Login';
import StudentChecklist from './pages/StudentChecklist';
import ParentDashboard from './pages/ParentDashboard';
import Records from './pages/Records';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route
            path="/today"
            element={
              <RequireRole role="student">
                <StudentChecklist />
              </RequireRole>
            }
          />
          <Route
            path="/dashboard"
            element={
              <RequireRole role="parent">
                <ParentDashboard />
              </RequireRole>
            }
          />
          <Route
            path="/records"
            element={
              <RequireRole role="parent">
                <Records />
              </RequireRole>
            }
          />
          {/* Abi peeking at (or driving) a kid's own page — same live view they see */}
          <Route
            path="/dashboard/kid/:kidId"
            element={
              <RequireRole role="parent">
                <StudentChecklist />
              </RequireRole>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
