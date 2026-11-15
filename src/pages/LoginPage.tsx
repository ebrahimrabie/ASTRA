import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loginApi } from '../api/client';
import { Badge } from '../components/Badge';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { useAstra } from '../context/AstraContext';
import { useI18n } from '../i18n';

export function LoginPage() {
  const navigate = useNavigate();
  const {
    enterDemoMode,
    setSessionData,
    sessionExpiredNotice,
    setSessionExpiredNotice,
    showToast,
  } = useAstra();
  const { t, trError } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleEnterDemo = () => {
    enterDemoMode();
    navigate('/', { replace: true });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError(t('auth.missingLoginFields'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await loginApi({ email: email.trim(), password });
      setSessionData({
        user: res.user,
        mission: res.mission,
        derived: res.derived,
        preferences: res.preferences,
      });
      setSessionExpiredNotice(false);
      showToast(t('auth.signedInToast', { name: res.user.name }));
      navigate('/', { replace: true });
    } catch (err) {
      setError(trError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <main className="card hero-card login-card">
        <div className="section-header">
          <div className="astra-logo">{t('app.brand')}</div>
          <LanguageSwitcher />
        </div>
        <div className="page-header-left">
          <h1>{t('app.fullName')}</h1>
          <p className="muted-text">{t('safety.disclaimer')}</p>
        </div>

        {sessionExpiredNotice && (
          <div className="banner" role="alert">
            {t('errors.SESSION_EXPIRED')}
          </div>
        )}

        <form className="form-stack" onSubmit={(e) => void handleLogin(e)} noValidate>
          <div className="field">
            <label htmlFor="login-email-input">{t('auth.email')}</label>
            <input
              id="login-email-input"
              type="email"
              className="input"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder={t('auth.emailPlaceholder')}
            />
          </div>

          <div className="field">
            <label htmlFor="password-input">{t('auth.password')}</label>
            <input
              id="password-input"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder={t('auth.passwordPlaceholder')}
            />
          </div>

          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}

          <div className="badge-row">
            <Badge label="ONLINE" />
            <span className="small-text">{t('auth.roleScopedNote')}</span>
          </div>

          <div className="form-stack">
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? t('auth.signingIn') : t('auth.signInTitle')}
            </button>
            <Link to="/register" className="btn btn-secondary">
              {t('auth.createAccountBtn')}
            </Link>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleEnterDemo}
            >
              {t('auth.enterDemoBtn')}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
