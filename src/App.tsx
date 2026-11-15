import { useEffect } from 'react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { Layout } from './components/Layout';
import { AstraProvider, useAstra } from './context/AstraContext';
import { I18nProvider, useI18n } from './i18n';
import { AchievementsPage } from './pages/AchievementsPage';
import { AlertsPage } from './pages/AlertsPage';
import { AssistantPage } from './pages/AssistantPage';
import { CalendarPage } from './pages/CalendarPage';
import { DemoScenariosPage } from './pages/DemoScenariosPage';
import { HealthDetailPage } from './pages/HealthDetailPage';
import { HealthListPage } from './pages/HealthListPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { ProfilePage } from './pages/ProfilePage';
import { ProtocolPage } from './pages/ProtocolPage';
import { RegisterPage } from './pages/RegisterPage';
import { ReportsPage } from './pages/ReportsPage';
import { RiskDetailPage } from './pages/RiskDetailPage';
import { RisksListPage } from './pages/RisksListPage';
import { RulesPage } from './pages/RulesPage';
import { SettingsPage } from './pages/SettingsPage';
import { SourcesPage } from './pages/SourcesPage';
import { TelemetryPage } from './pages/TelemetryPage';

function ProtectedShell({ children }: { children: React.ReactNode }) {
  const { demoUserId, authUser, authReady, enterDemoMode } = useAstra();
  const { t } = useI18n();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const autostart = params.get('autostart') === '1';

  useEffect(() => {
    if (authReady && !authUser && !demoUserId && autostart) {
      enterDemoMode();
    }
  }, [authReady, authUser, autostart, demoUserId, enterDemoMode]);

  if (!authReady) {
    return (
      <div className="login-page">
        <p className="muted-text">{t('app.loadingWorkspace')}</p>
      </div>
    );
  }

  if (!authUser && !demoUserId && !autostart) {
    return <Navigate to="/login" replace />;
  }

  return <Layout>{children}</Layout>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/"
        element={
          <ProtectedShell>
            <HomePage />
          </ProtectedShell>
        }
      />
      <Route
        path="/health"
        element={
          <ProtectedShell>
            <HealthListPage />
          </ProtectedShell>
        }
      />
      <Route
        path="/health/:id"
        element={
          <ProtectedShell>
            <HealthDetailPage />
          </ProtectedShell>
        }
      />
      <Route
        path="/risks"
        element={
          <ProtectedShell>
            <RisksListPage />
          </ProtectedShell>
        }
      />
      <Route
        path="/risks/:id"
        element={
          <ProtectedShell>
            <RiskDetailPage />
          </ProtectedShell>
        }
      />
      <Route
        path="/calendar"
        element={
          <ProtectedShell>
            <CalendarPage />
          </ProtectedShell>
        }
      />
      <Route
        path="/alerts"
        element={
          <ProtectedShell>
            <AlertsPage />
          </ProtectedShell>
        }
      />
      <Route
        path="/rules"
        element={
          <ProtectedShell>
            <RulesPage />
          </ProtectedShell>
        }
      />
      <Route
        path="/sources"
        element={
          <ProtectedShell>
            <SourcesPage />
          </ProtectedShell>
        }
      />
      <Route
        path="/protocol"
        element={
          <ProtectedShell>
            <ProtocolPage />
          </ProtectedShell>
        }
      />
      <Route
        path="/assistant"
        element={
          <ProtectedShell>
            <AssistantPage />
          </ProtectedShell>
        }
      />
      <Route
        path="/telemetry"
        element={
          <ProtectedShell>
            <TelemetryPage />
          </ProtectedShell>
        }
      />
      <Route
        path="/achievements"
        element={
          <ProtectedShell>
            <AchievementsPage />
          </ProtectedShell>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedShell>
            <ReportsPage />
          </ProtectedShell>
        }
      />
      <Route
        path="/demo-scenarios"
        element={
          <ProtectedShell>
            <DemoScenariosPage />
          </ProtectedShell>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedShell>
            <SettingsPage />
          </ProtectedShell>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedShell>
            <ProfilePage />
          </ProtectedShell>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AstraProvider>
      <I18nProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </I18nProvider>
    </AstraProvider>
  );
}
