import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Tilt } from '../components/Tilt';

const FEATURE_CHIP_KEYS = ['login.chipDashboard', 'login.chipEntry', 'login.chipReceipt', 'nav.eb', 'login.chipTenants'];

export function Login() {
  const { user, loading, loginUrl } = useAuth();
  const { language, setLanguage, t } = useLanguage();

  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-navy px-4 text-white">
      {/* Ambient animated gradient blobs -- purely decorative, respects prefers-reduced-motion via animate-floaty */}
      <div
        aria-hidden="true"
        className="animate-floaty absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand-blue/30 blur-[90px]"
      />
      <div
        aria-hidden="true"
        className="animate-floaty absolute -bottom-32 -right-16 h-80 w-80 rounded-full bg-brand-purple/25 blur-[100px]"
        style={{ animationDelay: '-3s' }}
      />
      <div
        aria-hidden="true"
        className="animate-floaty absolute right-1/3 top-1/4 h-40 w-40 rounded-full bg-brand-orange/15 blur-[70px]"
        style={{ animationDelay: '-1.5s' }}
      />

      <Tilt max={4} className="relative w-full max-w-sm">
        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-8 text-center shadow-elevated backdrop-blur-xl">
          <button
            type="button"
            onClick={() => setLanguage(language === 'ta' ? 'en' : 'ta')}
            className="mb-4 rounded bg-white/10 px-2.5 py-1 text-xs font-medium hover:bg-white/20"
          >
            {language === 'ta' ? 'த / EN' : 'EN / த'}
          </button>
          <div className="animate-floaty text-5xl">🏠</div>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight">வாடகை Pro</h1>
          <p className="mt-1 text-white/70">{t('login.tagline')}</p>

          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {FEATURE_CHIP_KEYS.map((key) => (
              <span key={key} className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs">
                {t(key)}
              </span>
            ))}
          </div>

          <a
            href={loginUrl || '#'}
            aria-disabled={!loginUrl}
            className={`mt-8 flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 font-medium text-navy shadow-elevated transition-transform duration-200 ease-premium ${
              loginUrl ? 'hover:-translate-y-0.5 hover:bg-white/90' : 'cursor-not-allowed opacity-60'
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.13-.84 2.09-1.79 2.73v2.27h2.9c1.7-1.57 2.68-3.87 2.68-6.64z"
              />
              <path
                fill="#34A853"
                d="M9 18c2.43 0 4.47-.8 5.96-2.17l-2.9-2.27c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.34C2.45 15.98 5.48 18 9 18z"
              />
              <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 013.68 9c0-.59.1-1.17.27-1.7V4.96H.96A9 9 0 000 9c0 1.45.35 2.83.96 4.04l2.99-2.34z" />
              <path
                fill="#EA4335"
                d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0 5.48 0 2.45 2.02.96 4.96l2.99 2.34C4.66 5.17 6.65 3.58 9 3.58z"
              />
            </svg>
            {t('login.signIn')}
          </a>
          {!loginUrl && (
            <p className="mt-3 text-xs text-white/50">
              {t('login.oauthNotConfigured')}
            </p>
          )}
        </div>
      </Tilt>
    </div>
  );
}
