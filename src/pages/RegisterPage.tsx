import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerApi } from '../api/client';
import { Badge } from '../components/Badge';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { useAstra } from '../context/AstraContext';
import { useI18n } from '../i18n';
import type { UserRole } from '../types';

export function RegisterPage() {
  const navigate = useNavigate();
  const { setSessionData, showToast } = useAstra();
  const { t, trError } = useI18n();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('COMMANDER');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !email.trim() || password.length < 8) {
      setError(t('auth.registerInvalid'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await registerApi({
        name: name.trim(),
        email: email.trim(),
        password,
        role,
        inviteCode: inviteCode.trim() || undefined,
      });
      setSessionData({
        user: res.user,
        mission: res.mission,
        derived: null,
        preferences: res.preferences,
      });
      showToast(t('auth.accountCreatedToast'));
      navigate('/', { replace: true });
    } catch (err) {
      setError(trError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <main className="card hero-card login-card" style={{ maxWidth: 460 }}>
        <div className="section-header">
          <div className="astra-logo">{t('app.brand')}</div>
          <LanguageSwitcher />
        </div>
        <div className="page-header-left">
          <h1>{t('auth.registerTitle')}</h1>
          <p className="muted-text">{t('safety.disclaimer')}</p>
        </div>

        <form className="form-stack" onSubmit={(e) => void handleSubmit(e)} noValidate>
          <div className="field">
            <label htmlFor="reg-name">{t('auth.fullName')}</label>
            <input
              id="reg-name"
              type="text"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('auth.fullNamePlaceholder')}
            />
          </div>

          <div className="field">
            <label htmlFor="reg-email">{t('auth.email')}</label>
            <input
              id="reg-email"
              type="email"
              dir="ltr"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth.regEmailPlaceholder')}
            />
          </div>

          <div className="field">
            <label htmlFor="reg-password">{t('auth.passwordMinLabel')}</label>
            <input
              id="reg-password"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('auth.passwordMinPlaceholder')}
            />
          </div>

          <div className="field">
            <label htmlFor="reg-role">{t('auth.missionRole')}</label>
            <select
              id="reg-role"
              className="input"
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
            >
              <option value="COMMANDER">{t('roles.commanderDesc')}</option>
              <option value="DOCTOR">{t('roles.doctorDesc')}</option>
              <option value="CREW">{t('roles.crewDesc')}</option>
            </select>
          </div>

          {role !== 'COMMANDER' && (
            <div className="field">
              <label htmlFor="reg-invite">{t('auth.inviteOptionalLabel')}</label>
              <input
                id="reg-invite"
                type="text"
                dir="ltr"
                className="input"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder={t('auth.invitePlaceholder')}
              />
            </div>
          )}

          <div className="badge-row">
            <Badge label={role} />
            <span className="small-text">
              {role === 'COMMANDER' ? t('auth.commanderHint') : t('auth.joinHint')}
            </span>
          </div>

          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}

          <div className="form-stack">
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? t('auth.registering') : t('auth.registerBtn')}
            </button>
            <Link to="/login" className="btn btn-secondary">
              {t('auth.alreadyHaveAccount')}
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}
