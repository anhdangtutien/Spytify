import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { X, Lock, User as UserIcon, Sparkles, Loader2, Disc, Mail, AlertTriangle, Settings2, Info, CheckCircle2 } from 'lucide-react';
import { User } from '../types';
import { isSupabaseConfigured, cloudRegisterUser, cloudLoginUser } from '../services/supabase';
import { getTranslation, LanguageCode } from '../locales/i18n';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: User) => void;
  language?: LanguageCode;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess, language = 'vi' }) => {
  const t = (key: string) => getTranslation(language, `auth.${key}`);
  const [isRegister, setIsRegister] = useState(false);
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [showDevClientId, setShowDevClientId] = useState(false);

  // Form states
  const [identifier, setIdentifier] = useState(''); // username or email for login
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Google states
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleName, setGoogleName] = useState('');
  const [googleClientId, setGoogleClientId] = useState(() => localStorage.getItem('soundify_google_client_id') || '');

  if (!isOpen) return null;

  // Real Email validation
  const validateRealEmail = (mail: string): { valid: boolean; reason?: string } => {
    const trimmed = mail.trim().toLowerCase();
    if (!trimmed.includes('@') || !trimmed.includes('.')) {
      return { valid: false, reason: t('emailSyntax') };
    }
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(trimmed)) {
      return { valid: false, reason: t('emailInvalidCharacters') };
    }
    const domain = trimmed.split('@')[1];
    if (!domain.includes('.')) {
      return { valid: false, reason: t('emailDomainInvalid') };
    }
    return { valid: true };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isRegister) {
      const emailCheck = validateRealEmail(registerEmail);
      if (!emailCheck.valid) {
        setError(emailCheck.reason || t('emailInvalid'));
        return;
      }
      if (password.length < 6) {
        setError(t('passwordMin'));
        return;
      }
      if (registerUsername.trim().length < 3) {
        setError(t('usernameMin'));
        return;
      }

      setLoading(true);
      try {
        // Check if user already exists in Supabase Cloud! If password matches, log in directly
        if (isSupabaseConfigured()) {
          try {
            const cloudUser = await cloudLoginUser(registerEmail.trim().toLowerCase(), password);
            if (cloudUser) {
              onSuccess(cloudUser);
              onClose();
              return;
            }
          } catch (e) {}
        }

        const user = await invoke<User>('auth_register', {
          username: registerUsername.trim(),
          email: registerEmail.trim().toLowerCase(),
          password,
          displayName: displayName.trim() || registerUsername.trim(),
        });

        // Sync credentials to Supabase Cloud so other devices can log in!
        if (isSupabaseConfigured()) {
          try {
            const creds = await invoke<[string, string] | null>('auth_get_credentials', { userId: user.id });
            if (creds) {
              await cloudRegisterUser(user, registerEmail.trim().toLowerCase(), creds[0], creds[1]);
            }
          } catch (e) {
            console.warn('Could not sync registration to Supabase:', e);
          }
        }

        onSuccess(user);
        onClose();
      } catch (err: unknown) {
        setError(typeof err === 'string' ? err : t('registerFailed'));
      } finally {
        setLoading(false);
      }

    } else {
      // Login by Username or Email
      if (!identifier.trim()) {
        setError(t('identifierRequired'));
        return;
      }

      setLoading(true);
      try {
        let user: User | null = null;
        const rawIdentifier = identifier.trim();
        const cleanUsername = rawIdentifier.replace(/^@+/, '');
        try {
          user = await invoke<User>('auth_login', {
            username: cleanUsername,
            password,
          });
        } catch (localErr) {
          // If not found in local SQLite, attempt cloud login from Supabase!
          if (isSupabaseConfigured()) {
            user = await cloudLoginUser(rawIdentifier, password);
          }
          if (!user) throw localErr;
        }

        if (user) {
          // Keep Supabase updated with credentials so other machines can authenticate
          if (isSupabaseConfigured()) {
            try {
              const creds = await invoke<[string, string] | null>('auth_get_credentials', { userId: user.id });
              if (creds) {
                await cloudRegisterUser(user, user.email || null, creds[0], creds[1]);
              }
            } catch (e) {}
          }
          onSuccess(user);
          onClose();
        }
      } catch (err: unknown) {
        setError(typeof err === 'string' ? err : t('credentialsInvalid'));
      } finally {
        setLoading(false);
      }
    }
  };

  const handleQuickGoogleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = googleEmail.trim().toLowerCase();
    const emailCheck = validateRealEmail(cleanEmail);
    if (!emailCheck.valid) {
      setError(emailCheck.reason || t('gmailRequired'));
      return;
    }

    setLoading(true);
    try {
      const user = await invoke<User>('auth_google_login', {
        googleId: cleanEmail,
        email: cleanEmail,
        displayName: googleName.trim() || cleanEmail.split('@')[0],
        avatar: null,
      });

      // Sync to Supabase if configured so other devices instantly share the account!
      if (isSupabaseConfigured()) {
        try {
          await cloudRegisterUser(user, cleanEmail, 'GOOGLE_OAUTH', 'GOOGLE_OAUTH');
        } catch (e) {
          console.warn('Could not sync Google user to Supabase:', e);
        }
      }

      onSuccess(user);
      onClose();
    } catch (err: unknown) {
      setError(typeof err === 'string' ? err : t('googleLoginFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleBrowserGoogleOAuth = async () => {
    setError(null);

    if (googleClientId.includes('@')) {
      setError(t('clientIdLooksLikeEmail'));
      return;
    }

    if (!googleClientId.trim()) {
      setShowDevClientId(true);
      return;
    }

    setLoading(true);
    try {
      localStorage.setItem('soundify_google_client_id', googleClientId.trim());
      const user = await invoke<User>('auth_start_google_oauth', {
        customClientId: googleClientId.trim(),
        clientSecret: null,
      });
      if (isSupabaseConfigured()) {
        try {
          await cloudRegisterUser(user, user.email || null, 'GOOGLE_OAUTH', 'GOOGLE_OAUTH');
        } catch (e) {}
      }
      onSuccess(user);
      onClose();
    } catch (err: unknown) {
      setError(typeof err === 'string' ? err : t('googleLoginFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-[#080808] border border-[#1e1e1e] rounded-2xl p-6 shadow-2xl relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-[#666] hover:text-white hover:bg-[#181818] transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Brand Header */}
        <div className="text-center mb-5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ff2a55] to-[#ffffff] text-black flex items-center justify-center mx-auto mb-2 shadow-[0_0_12px_rgba(255,230,0,0.35)]">
            <Disc className="w-6 h-6 text-black" />
          </div>
          <h2 className="text-base font-black tracking-tight text-white uppercase flex items-center justify-center gap-1.5">
            SPYTIFY ACCOUNT
          </h2>
          <p className="text-[11px] text-[#ffffff] font-mono">{t('sqliteStatus')}</p>
        </div>

        {/* Google Login Modal Screen */}
        {showGoogleModal ? (
          <div className="space-y-3 animate-in fade-in duration-200">
            <div className="p-3 bg-[#121212] rounded-xl border border-[#222]">
              <div className="flex items-center gap-2 text-white font-semibold text-xs mb-1">
                <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>{t('googleQuickTitle')}</span>
              </div>
              <p className="text-[11px] text-[#888] leading-relaxed">
                {t('googleQuickDescription')}
              </p>
            </div>

            {/* Error Alert */}
            {error && (
              <div className="p-2.5 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start gap-1.5">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleQuickGoogleLogin} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase text-[#777] mb-1 font-mono">
                  {t('gmailAddress')}
                </label>
                <div className="relative flex items-center">
                  <Mail className="w-4 h-4 text-[#555] absolute left-3 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={googleEmail}
                    onChange={(e) => setGoogleEmail(e.target.value)}
                    placeholder={t('gmailPlaceholder')}
                    className="w-full pl-9 pr-3 py-2 bg-[#0f0f0f] text-white text-xs rounded-lg border border-[#222] focus:border-[#4285F4] outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase text-[#777] mb-1 font-mono">
                  {t('displayNameOptional')}
                </label>
                <div className="relative flex items-center">
                  <UserIcon className="w-4 h-4 text-[#555] absolute left-3 pointer-events-none" />
                  <input
                    type="text"
                    value={googleName}
                    onChange={(e) => setGoogleName(e.target.value)}
                    placeholder={t('displayNameExample')}
                    className="w-full pl-9 pr-3 py-2 bg-[#0f0f0f] text-white text-xs rounded-lg border border-[#222] focus:border-[#4285F4] outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowGoogleModal(false)}
                  className="flex-1 py-2 rounded-lg bg-[#141414] text-[#888] hover:text-white text-xs font-semibold cursor-pointer"
                >
                  {t('back')}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2 rounded-lg bg-[#4285F4] hover:bg-[#3367d6] text-white text-xs font-bold uppercase cursor-pointer transition-colors flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>{t('loginNow')}</span>}
                </button>
              </div>
            </form>

            {/* Developer Client ID Toggle */}
            <div className="pt-2 border-t border-[#1a1a1a]">
              <button
                type="button"
                onClick={() => setShowDevClientId(!showDevClientId)}
                className="text-[10px] text-[#555] hover:text-[#999] flex items-center gap-1 cursor-pointer font-mono"
              >
                <Settings2 className="w-3 h-3" />
                <span>{showDevClientId ? t('hideClientId') : t('developerClientId')}</span>
              </button>

              {showDevClientId && (
                <div className="mt-2 space-y-2 animate-in fade-in duration-150">
                  <input
                    type="text"
                    value={googleClientId}
                    onChange={(e) => setGoogleClientId(e.target.value)}
                    placeholder="xxxxxx.apps.googleusercontent.com"
                    className="w-full px-2.5 py-1.5 bg-[#0a0a0a] text-white text-[10px] rounded border border-[#222] focus:border-[#4285F4] outline-none font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleBrowserGoogleOAuth}
                    disabled={loading || !googleClientId.trim()}
                    className="w-full py-1.5 rounded bg-[#1e1e1e] hover:bg-[#282828] text-white text-[10px] font-semibold cursor-pointer transition-colors disabled:opacity-40"
                  >
                    {t('openOAuth')}
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div>
            {/* Google Login Button */}
            <button
              type="button"
              onClick={() => { setError(null); setShowGoogleModal(true); }}
              disabled={loading}
              className="w-full py-2.5 px-4 bg-[#141414] hover:bg-[#1a1a1a] text-white font-semibold text-xs rounded-xl border border-[#262626] transition-all flex items-center justify-center gap-2.5 cursor-pointer shadow-sm mb-4"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>{t('googleLogin')}</span>
            </button>

            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 h-px bg-[#181818]" />
              <span className="text-[10px] text-[#555] uppercase font-mono">{t('orLoginWithEmail')}</span>
              <div className="flex-1 h-px bg-[#181818]" />
            </div>

            {/* Tabs: Login / Register */}
            <div className="flex border-b border-[#181818] mb-4">
              <button
                onClick={() => { setIsRegister(false); setError(null); }}
                className={`flex-1 py-1.5 text-xs font-semibold uppercase tracking-wider text-center transition-colors cursor-pointer ${
                  !isRegister
                    ? 'text-white border-b-2 border-[#ffffff]'
                    : 'text-[#666] hover:text-[#999]'
                }`}
              >
                {t('loginTab')}
              </button>
              <button
                onClick={() => { setIsRegister(true); setError(null); }}
                className={`flex-1 py-1.5 text-xs font-semibold uppercase tracking-wider text-center transition-colors cursor-pointer ${
                  isRegister
                    ? 'text-white border-b-2 border-[#ffffff]'
                    : 'text-[#666] hover:text-[#999]'
                }`}
              >
                {t('registerTab')}
              </button>
            </div>

            {/* Error Alert */}
            {error && (
              <div className="mb-4 p-2.5 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start gap-1.5">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              {isRegister ? (
                <>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#777] mb-1 font-mono">
                      {t('realEmail')}
                    </label>
                    <div className="relative flex items-center">
                      <Mail className="w-4 h-4 text-[#555] absolute left-3 pointer-events-none" />
                      <input
                        type="email"
                        required
                        value={registerEmail}
                        onChange={(e) => setRegisterEmail(e.target.value)}
                        placeholder={t('gmailPlaceholder')}
                        className="w-full pl-9 pr-3 py-2 bg-[#0f0f0f] text-white text-xs rounded-lg border border-[#222] focus:border-[#ffffff] outline-none transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#777] mb-1 font-mono">
                      {t('username')}
                    </label>
                    <div className="relative flex items-center">
                      <UserIcon className="w-4 h-4 text-[#555] absolute left-3 pointer-events-none" />
                      <input
                        type="text"
                        required
                        value={registerUsername}
                        onChange={(e) => setRegisterUsername(e.target.value)}
                        placeholder={t('usernameExample')}
                        className="w-full pl-9 pr-3 py-2 bg-[#0f0f0f] text-white text-xs rounded-lg border border-[#222] focus:border-[#ffffff] outline-none transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#777] mb-1 font-mono">
                {t('displayNameOptional')}
                    </label>
                    <div className="relative flex items-center">
                      <UserIcon className="w-4 h-4 text-[#555] absolute left-3 pointer-events-none" />
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder={t('displayNameExample')}
                        className="w-full pl-9 pr-3 py-2 bg-[#0f0f0f] text-white text-xs rounded-lg border border-[#222] focus:border-[#ffffff] outline-none transition-colors"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#777] mb-1 font-mono">
                    {t('emailOrUsername')}
                  </label>
                  <div className="relative flex items-center">
                    <UserIcon className="w-4 h-4 text-[#555] absolute left-3 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder={t('identifierPlaceholder')}
                      className="w-full pl-9 pr-3 py-2 bg-[#0f0f0f] text-white text-xs rounded-lg border border-[#222] focus:border-[#ffffff] outline-none transition-colors"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#777] mb-1 font-mono">
                  {t('password')}
                </label>
                <div className="relative flex items-center">
                  <Lock className="w-4 h-4 text-[#555] absolute left-3 pointer-events-none" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('passwordPlaceholder')}
                    className="w-full pl-9 pr-3 py-2 bg-[#0f0f0f] text-white text-xs rounded-lg border border-[#222] focus:border-[#ffffff] outline-none transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-2.5 px-4 bg-gradient-to-r from-[#ff2a55] to-[#ffffff] hover:opacity-95 text-black font-black text-xs uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_12px_rgba(255,230,0,0.3)] disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
              <span>{isRegister ? t('createAccountNow') : t('loginTab')}</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        <p className="text-[10px] text-[#444] text-center mt-4">
          {t('sqliteFooter')}
        </p>
      </div>
    </div>
  );
};
