import { useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

export function AuthCallback() {
  const [params] = useSearchParams();
  const { handleGoogleCallback } = useAuth();
  const { t } = useLanguage();
  const [status, setStatus] = useState<'working' | 'done' | 'error'>('working');

  useEffect(() => {
    const code = params.get('code');
    if (!code) {
      setStatus('error');
      return;
    }
    handleGoogleCallback(code)
      .then(() => setStatus('done'))
      .catch(() => setStatus('error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === 'done') return <Navigate to="/" replace />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy text-white">
      {status === 'working' ? (
        <p>{t('auth.signingIn')}</p>
      ) : (
        <div className="text-center">
          <p>{t('auth.signInFailed')}</p>
          <a href="/login" className="mt-2 inline-block underline">
            {t('auth.tryAgain')}
          </a>
        </div>
      )}
    </div>
  );
}
