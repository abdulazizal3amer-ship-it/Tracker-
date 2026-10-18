import { Navigate, Route, Routes } from 'react-router-dom';
import { isConfigured } from './lib/supabase.js';
import { AuthProvider, useAuth } from './lib/auth.jsx';
import { useI18n } from './lib/i18n.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import SetPassword from './pages/SetPassword.jsx';
import Dashboard from './pages/Dashboard.jsx';
import MyTasks from './pages/MyTasks.jsx';
import Projects from './pages/Projects.jsx';
import ProjectView from './pages/ProjectView.jsx';
import Users from './pages/Users.jsx';

function NotConfigured() {
  const { t } = useI18n();
  return (
    <div className="center-screen">
      <div className="card narrow">
        <h1>{t('setup_title')}</h1>
        <p className="muted">{t('setup_body')}</p>
      </div>
    </div>
  );
}

function Gate() {
  const { session, profile, recovery } = useAuth();
  const { t } = useI18n();

  if (session === undefined || (session && !profile)) {
    return <div className="center-screen muted">{t('loading')}</div>;
  }
  if (!session) return <Login />;
  if (recovery || profile.must_change_password) return <SetPassword forced />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="my" element={<MyTasks />} />
        <Route path="projects" element={<Projects />} />
        <Route path="projects/:id" element={<ProjectView />} />
        <Route path="password" element={<SetPassword />} />
        {profile.role === 'admin' && <Route path="users" element={<Users />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  if (!isConfigured) return <NotConfigured />;
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
