import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  X,
  Lock,
  User as UserIcon,
  Sparkles,
  Loader2,
  Disc,
  Mail,
  AlertTriangle,
  Settings2,
  CheckCircle2,
  ArrowLeft,
  KeyRound,
  Trash2,
  PlusCircle,
  HelpCircle,
  Copy,
  Check,
  ShieldCheck,
  Smartphone
} from 'lucide-react';
import { User } from '../types';
import { verifyTotp, generateTotpSecret, getOtpAuthUrl, getQrCodeImageUrl } from '../services/totp';
import {
  isSupabaseConfigured,
  cloudRegisterUser,
  cloudLoginUser,
  cloudFindUserByEmail,
  cloudFindUserByUsernameOrEmail,
  cloudResetUserPassword,
  cloudSetTwoFactor,
  getSupabaseClient
} from '../services/supabase';
import { getTranslation, LanguageCode } from '../locales/i18n';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: User) => void;
  language?: LanguageCode;
}

export interface SavedAccountProfile {
  id: string;
  username: string;
  displayName: string;
  email?: string | null;
  avatar?: string | null;
  lastLogin: number;
  savedPassword?: string;
}

const SAVED_ACCOUNTS_KEY = 'spytify_saved_account_profiles';

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess, language = 'vi' }) => {
  const t = (key: string, params?: Record<string, string | number>) => getTranslation(language, `auth.${key}`, params);
  
  // Tabs: 'login' | 'register' | 'forgot_password'
  const [activeTab, setActiveTab] = useState<'login' | 'register' | 'forgot_password'>('login');
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [showDevClientId, setShowDevClientId] = useState(false);

  // Form states
  const [identifier, setIdentifier] = useState('');
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Remember password state
  const [rememberPassword, setRememberPassword] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('spytify_remember_password');
      return stored !== 'false';
    } catch {
      return true;
    }
  });

  // Saved accounts state
  const [savedAccounts, setSavedAccounts] = useState<SavedAccountProfile[]>(() => {
    try {
      const stored = localStorage.getItem(SAVED_ACCOUNTS_KEY);
      if (stored) return JSON.parse(stored);
    } catch {}
    return [];
  });
  const [selectedSavedAccount, setSelectedSavedAccount] = useState<SavedAccountProfile | null>(null);

  // Forgot password states
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetCodeInput, setResetCodeInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [targetResetUser, setTargetResetUser] = useState<{
    id: string;
    username: string;
    email: string;
    two_factor_enabled?: boolean;
    two_factor_secret?: string | null;
    two_factor_scope?: 'both' | 'login' | 'reset_password' | null;
  } | null>(null);
  const [codeSentStep, setCodeSentStep] = useState(false);
  const [resetUserHas2Fa, setResetUserHas2Fa] = useState(false);

  // Google Authenticator 2FA Verification States (Login)
  const [is2FaStep, setIs2FaStep] = useState(false);
  const [twoFactorCodeInput, setTwoFactorCodeInput] = useState('');
  const [pending2FaUser, setPending2FaUser] = useState<User | null>(null);
  const [pending2FaPassword, setPending2FaPassword] = useState('');

  // 2FA Setup upon Account Creation (Registration)
  const [setup2FaOnRegister, setSetup2FaOnRegister] = useState(true);
  const [showRegister2FaSetup, setShowRegister2FaSetup] = useState(false);
  const [createdUserFor2Fa, setCreatedUserFor2Fa] = useState<User | null>(null);
  const [createdUserPassword, setCreatedUserPassword] = useState('');
  const [register2FaSecret, setRegister2FaSecret] = useState('');
  const [register2FaCodeInput, setRegister2FaCodeInput] = useState('');
  const [register2FaScope, setRegister2FaScope] = useState<'reset_password' | 'both'>('reset_password');
  const [register2FaCopied, setRegister2FaCopied] = useState(false);
  const [register2FaLoading, setRegister2FaLoading] = useState(false);
  const [register2FaError, setRegister2FaError] = useState<string | null>(null);

  // Google states
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleName, setGoogleName] = useState('');
  const [googleClientId, setGoogleClientId] = useState(() => localStorage.getItem('soundify_google_client_id') || '');

  // Reload saved accounts when opening modal from SQLite and localStorage
  useEffect(() => {
    if (!isOpen) return;

    // Luôn reset trạng thái quên mật khẩu & 2FA khi mở modal để tránh bị kẹt tài khoản trước đó
    setCodeSentStep(false);
    setTargetResetUser(null);
    setResetCodeInput('');
    setNewPasswordInput('');
    setResetUserHas2Fa(false);
    setIs2FaStep(false);
    setTwoFactorCodeInput('');
    setPending2FaUser(null);
    setShowRegister2FaSetup(false);
    setCreatedUserFor2Fa(null);
    setCreatedUserPassword('');
    setRegister2FaSecret('');
    setRegister2FaCodeInput('');
    setRegister2FaError(null);
    setError(null);
    setSuccessMsg(null);

    let isMounted = true;
    const syncLocalAccounts = async () => {
      let storedList: SavedAccountProfile[] = [];
      try {
        const stored = localStorage.getItem(SAVED_ACCOUNTS_KEY);
        if (stored) {
          storedList = JSON.parse(stored);
        }
      } catch {}

      try {
        const dbUsers = await invoke<User[]>('auth_get_saved_accounts');
        if (isMounted && Array.isArray(dbUsers) && dbUsers.length > 0) {
          const byId = new Map<string, SavedAccountProfile>();
          // Add existing accounts from localStorage first (preserves saved passwords)
          storedList.forEach(acc => byId.set(acc.id, acc));
          // Merge with all local accounts from SQLite database
          dbUsers.forEach(u => {
            const prev = byId.get(u.id);
            byId.set(u.id, {
              id: u.id,
              username: u.username,
              displayName: u.display_name || u.username,
              email: u.email || null,
              avatar: u.avatar || prev?.avatar || null,
              savedPassword: prev?.savedPassword,
              lastLogin: prev?.lastLogin || Date.now(),
            });
          });
          const merged = Array.from(byId.values());
          setSavedAccounts(merged);
          localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(merged));
          if (merged.length > 0 && !selectedSavedAccount) {
            setSelectedSavedAccount(merged[0]);
            setIdentifier(merged[0].username || merged[0].email || '');
            if (merged[0].savedPassword) {
              setPassword(merged[0].savedPassword);
            }
          }
          return;
        }
      } catch (err) {
        console.warn('Could not load accounts from SQLite:', err);
      }

      if (isMounted && storedList.length > 0) {
        setSavedAccounts(storedList);
        if (!selectedSavedAccount) {
          setSelectedSavedAccount(storedList[0]);
          setIdentifier(storedList[0].username || storedList[0].email || '');
          if (storedList[0].savedPassword) {
            setPassword(storedList[0].savedPassword);
          }
        }
      }
    };

    syncLocalAccounts();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const saveAccountProfileToStorage = (u: User, pwd?: string) => {
    try {
      localStorage.setItem('spytify_remember_password', rememberPassword ? 'true' : 'false');
      let currentSaved: SavedAccountProfile[] = savedAccounts;
      try {
        const raw = localStorage.getItem(SAVED_ACCOUNTS_KEY);
        if (raw) currentSaved = JSON.parse(raw);
      } catch {}

      const existingAccount = currentSaved.find(a => a.id === u.id || a.username.toLowerCase() === u.username.toLowerCase());
      const profile: SavedAccountProfile = {
        id: u.id,
        username: u.username,
        displayName: u.display_name || u.username,
        email: u.email || null,
        avatar: u.avatar || existingAccount?.avatar || null,
        lastLogin: Date.now(),
        savedPassword: rememberPassword ? (pwd || password || existingAccount?.savedPassword) : undefined,
      };
      const existing = currentSaved.filter(a => a.id !== u.id && a.username.toLowerCase() !== u.username.toLowerCase());
      const updated = [profile, ...existing].slice(0, 50); // Cho phép lưu tối đa 50 tài khoản trên máy
      setSavedAccounts(updated);
      localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(updated));
    } catch {}
  };

  const handleRemoveSavedAccount = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = savedAccounts.filter(a => a.id !== id);
    setSavedAccounts(updated);
    try {
      localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(updated));
    } catch {}
    if (selectedSavedAccount?.id === id) {
      if (updated.length > 0) {
        setSelectedSavedAccount(updated[0]);
        setIdentifier(updated[0].username || updated[0].email || '');
        setPassword(updated[0].savedPassword || '');
      } else {
        setSelectedSavedAccount(null);
        setIdentifier('');
        setPassword('');
      }
    }
  };

  const handlePickSavedAccount = (acc: SavedAccountProfile) => {
    setSelectedSavedAccount(acc);
    setIdentifier(acc.username || acc.email || '');
    if (acc.email) {
      setForgotEmail(acc.email);
    } else if (acc.username) {
      setForgotEmail(acc.username);
    }
    setCodeSentStep(false);
    setTargetResetUser(null);
    setResetCodeInput('');
    setNewPasswordInput('');
    setResetUserHas2Fa(false);
    if (acc.savedPassword) {
      setPassword(acc.savedPassword);
      setRememberPassword(true);
    } else {
      setPassword('');
    }
    setError(null);
    setSuccessMsg(null);
  };

  const handleUseOtherAccount = () => {
    setSelectedSavedAccount(null);
    setIdentifier('');
    setPassword('');
    setForgotEmail('');
    setCodeSentStep(false);
    setTargetResetUser(null);
    setResetCodeInput('');
    setNewPasswordInput('');
    setResetUserHas2Fa(false);
    setError(null);
    setSuccessMsg(null);
  };

  const handleOpenForgotPassword = () => {
    setActiveTab('forgot_password');
    setError(null);
    setSuccessMsg(null);
    setCodeSentStep(false);
    setTargetResetUser(null);
    setResetCodeInput('');
    setNewPasswordInput('');
    setResetUserHas2Fa(false);

    const currentAccount = selectedSavedAccount || savedAccounts.find(a => 
      a.username.toLowerCase() === identifier.trim().toLowerCase() ||
      a.email?.toLowerCase() === identifier.trim().toLowerCase()
    );

    if (currentAccount?.email) {
      setForgotEmail(currentAccount.email);
    } else if (identifier.trim()) {
      setForgotEmail(identifier.trim());
    } else {
      setForgotEmail('');
    }
  };

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
    setSuccessMsg(null);

    if (activeTab === 'register') {
      const emailCheck = validateRealEmail(registerEmail);
      if (!emailCheck.valid) {
        setError(emailCheck.reason || t('emailInvalidCharacters'));
        return;
      }

      setLoading(true);
      try {
        if (isSupabaseConfigured()) {
          try {
            const cloudUser = await cloudLoginUser(registerEmail.trim().toLowerCase(), password);
            if (cloudUser) {
              saveAccountProfileToStorage(cloudUser, password);
              onSuccess(cloudUser);
              onClose();
              return;
            }
          } catch {}
        }

        const user = await invoke<User>('auth_register', {
          username: registerUsername.trim(),
          email: registerEmail.trim().toLowerCase(),
          password,
          displayName: displayName.trim() || registerUsername.trim(),
        });

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

        if (setup2FaOnRegister) {
          const newSecret = generateTotpSecret(16);
          setRegister2FaSecret(newSecret);
          setCreatedUserFor2Fa(user);
          setCreatedUserPassword(password);
          setRegister2FaCodeInput('');
          setRegister2FaScope('reset_password'); // Ưu tiên chỉ reset mật khẩu trước
          setRegister2FaCopied(false);
          setRegister2FaError(null);
          setShowRegister2FaSetup(true);
          return;
        }

        saveAccountProfileToStorage(user, password);
        onSuccess(user);
        onClose();
      } catch (err: unknown) {
        setError(typeof err === 'string' ? err : t('registerFailed'));
      } finally {
        setLoading(false);
      }
    } else if (activeTab === 'login') {
      const rawIdentifier = selectedSavedAccount ? (selectedSavedAccount.username || selectedSavedAccount.email || identifier) : identifier;
      if (!rawIdentifier.trim()) {
        setError(t('identifierRequired'));
        return;
      }

      setLoading(true);
      try {
        let user: User | null = null;
        const cleanUsername = rawIdentifier.trim().replace(/^@+/, '');
        try {
          user = await invoke<User>('auth_login', {
            username: cleanUsername,
            password,
          });
        } catch (localErr) {
          if (isSupabaseConfigured()) {
            user = await cloudLoginUser(rawIdentifier.trim(), password);
          }
          if (!user) throw localErr;
        }

        if (user) {
          // Check if account has Google Authenticator 2FA enabled and check scope
          let has2Fa = Boolean(user.two_factor_enabled && user.two_factor_secret);
          let scope = user.two_factor_scope || 'both';
          try {
            const check2fa = await invoke<[boolean, string | null, string | null]>('auth_get_user_2fa', { userId: user.id });
            if (check2fa && check2fa[0] && check2fa[1]) {
              has2Fa = true;
              user.two_factor_enabled = true;
              user.two_factor_secret = check2fa[1];
              if (check2fa[2]) {
                scope = check2fa[2] as 'both' | 'login' | 'reset_password';
                user.two_factor_scope = scope;
              }
            }
          } catch {}

          const require2FaForLogin = has2Fa && (scope === 'both' || scope === 'login');

          if (require2FaForLogin) {
            setPending2FaUser(user);
            setPending2FaPassword(password);
            setTwoFactorCodeInput('');
            setIs2FaStep(true);
            setLoading(false);
            return;
          }

          if (isSupabaseConfigured()) {
            try {
              const creds = await invoke<[string, string] | null>('auth_get_credentials', { userId: user.id });
              if (creds) {
                await cloudRegisterUser(user, user.email || null, creds[0], creds[1]);
              }
            } catch {}
          }
          saveAccountProfileToStorage(user, password);
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

  // ──────── 1.5. REGISTER 2FA SETUP HANDLERS ────────
  const handleCopyRegisterSecret = () => {
    if (register2FaSecret) {
      navigator.clipboard.writeText(register2FaSecret);
      setRegister2FaCopied(true);
      setTimeout(() => setRegister2FaCopied(false), 2500);
    }
  };

  const handleSkipRegister2Fa = () => {
    if (createdUserFor2Fa) {
      saveAccountProfileToStorage(createdUserFor2Fa, createdUserPassword);
      onSuccess(createdUserFor2Fa);
    }
    setShowRegister2FaSetup(false);
    setCreatedUserFor2Fa(null);
    onClose();
  };

  const handleModalClose = () => {
    if (showRegister2FaSetup && createdUserFor2Fa) {
      handleSkipRegister2Fa();
      return;
    }
    onClose();
  };

  const handleConfirmRegister2Fa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createdUserFor2Fa || !register2FaSecret) return;
    setRegister2FaError(null);
    setRegister2FaLoading(true);

    try {
      const isValid = await verifyTotp(register2FaCodeInput, register2FaSecret);
      if (!isValid) {
        setRegister2FaError(language === 'vi' ? 'Mã xác nhận 6 chữ số không đúng hoặc đã hết hạn!' : 'Invalid or expired 6-digit verification code!');
        setRegister2FaLoading(false);
        return;
      }

      // Lưu thiết lập 2FA vào SQLite local database
      await invoke('auth_set_two_factor', {
        userId: createdUserFor2Fa.id,
        secret: register2FaSecret,
        enabled: true,
        scope: register2FaScope, // 'reset_password' (mặc định) hoặc 'both'
      });

      // Đồng bộ lên Supabase Cloud nếu có cấu hình
      if (isSupabaseConfigured()) {
        try {
          await cloudSetTwoFactor(createdUserFor2Fa.id, register2FaSecret, true, register2FaScope);
        } catch (cloudErr) {
          console.warn('Could not sync 2FA to Supabase Cloud:', cloudErr);
        }
      }

      const finalUser: User = {
        ...createdUserFor2Fa,
        two_factor_enabled: true,
        two_factor_secret: register2FaSecret,
        two_factor_scope: register2FaScope,
      };

      saveAccountProfileToStorage(finalUser, createdUserPassword);
      setShowRegister2FaSetup(false);
      setCreatedUserFor2Fa(null);
      onSuccess(finalUser);
      onClose();
    } catch (err: any) {
      setRegister2FaError(err?.message || (typeof err === 'string' ? err : 'Lỗi khi kích hoạt 2FA.'));
    } finally {
      setRegister2FaLoading(false);
    }
  };

  // ──────── 2. FORGOT PASSWORD & RECOVERY FLOW ────────
  const handleVerify2FaLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pending2FaUser || !pending2FaUser.two_factor_secret) return;
    setLoading(true);
    setError(null);
    try {
      const isValid = await verifyTotp(twoFactorCodeInput, pending2FaUser.two_factor_secret);
      if (!isValid) {
        setError('Mã xác thực Google Authenticator (6 chữ số) không chính xác hoặc đã hết hạn!');
        setLoading(false);
        return;
      }

      // 2FA Verified Successfully!
      if (isSupabaseConfigured()) {
        try {
          const creds = await invoke<[string, string] | null>('auth_get_credentials', { userId: pending2FaUser.id });
          if (creds) {
            await cloudRegisterUser(pending2FaUser, pending2FaUser.email || null, creds[0], creds[1]);
          }
        } catch {}
      }
      saveAccountProfileToStorage(pending2FaUser, pending2FaPassword);
      onSuccess(pending2FaUser);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Lỗi khi kiểm tra mã 2FA. Vui lòng thử lại!');
    } finally {
      setLoading(false);
    }
  };

  const handleSendRecoveryCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    const cleanInput = forgotEmail.trim();
    if (!cleanInput) {
      setError(language === 'vi' ? 'Vui lòng nhập Email hoặc Tên tài khoản' : 'Please enter Email or Username');
      return;
    }

    setLoading(true);
    try {
      // 1. Kiểm tra tài khoản bằng username hoặc email trong Supabase Cloud hoặc Local
      let foundUser: {
        id: string;
        username: string;
        display_name: string;
        email: string;
        two_factor_enabled?: boolean;
        two_factor_secret?: string | null;
        two_factor_scope?: 'both' | 'login' | 'reset_password' | null;
      } | null = null;
      if (isSupabaseConfigured()) {
        foundUser = await cloudFindUserByUsernameOrEmail(cleanInput);
      }
      
      if (!foundUser) {
        // Fallback kiểm tra savedAccounts hoặc SQLite
        const matchedSaved = savedAccounts.find(a => 
          a.email?.toLowerCase() === cleanInput.toLowerCase() ||
          a.username.toLowerCase() === cleanInput.toLowerCase()
        );
        if (matchedSaved && matchedSaved.email) {
          foundUser = {
            id: matchedSaved.id,
            username: matchedSaved.username,
            display_name: matchedSaved.displayName || matchedSaved.username,
            email: matchedSaved.email,
          };
        } else {
          try {
            const localUsers = await invoke<User[]>('auth_get_saved_accounts');
            const foundLocal = localUsers?.find(u => 
              u.email?.toLowerCase() === cleanInput.toLowerCase() ||
              u.username.toLowerCase() === cleanInput.toLowerCase()
            );
            if (foundLocal && foundLocal.email) {
              foundUser = {
                id: foundLocal.id,
                username: foundLocal.username,
                display_name: foundLocal.display_name,
                email: foundLocal.email,
                two_factor_enabled: foundLocal.two_factor_enabled,
                two_factor_secret: foundLocal.two_factor_secret,
                two_factor_scope: foundLocal.two_factor_scope,
              };
            }
          } catch {}
        }
      }

      if (!foundUser || !foundUser.email) {
        setError(language === 'vi' ? 'Không tìm thấy tài khoản hoặc tài khoản chưa có Email liên kết.' : t('emailNotFound'));
        setLoading(false);
        return;
      }

      const cleanMail = foundUser.email.toLowerCase();

      // Kiểm tra xem tài khoản này có bật 2FA (Google Authenticator) và scope có bao gồm đặt lại mật khẩu không
      let has2Fa = false;
      let scope = foundUser.two_factor_scope || 'both';
      try {
        const check2fa = await invoke<[boolean, string | null, string | null]>('auth_get_user_2fa', { userId: foundUser.id });
        if (check2fa && check2fa[0] && check2fa[1]) {
          has2Fa = true;
          foundUser.two_factor_enabled = true;
          foundUser.two_factor_secret = check2fa[1];
          if (check2fa[2]) {
            scope = check2fa[2] as 'both' | 'login' | 'reset_password';
            foundUser.two_factor_scope = scope;
          }
        }
      } catch {}

      setTargetResetUser(foundUser);
      const require2FaForReset = has2Fa && (scope === 'both' || scope === 'reset_password');
      setResetUserHas2Fa(require2FaForReset);

      if (require2FaForReset) {
        // Tài khoản yêu cầu 2FA khi đặt lại mật khẩu: Xác minh trực tiếp qua mã Google Authenticator
        setCodeSentStep(true);
        setSuccessMsg(
          language === 'vi'
            ? 'Tài khoản yêu cầu bảo mật 2FA. Vui lòng mở ứng dụng Google Authenticator trên điện thoại để lấy mã xác thực 6 chữ số.'
            : 'Two-factor authentication is required. Please enter the 6-digit code from your Authenticator app.'
        );
      } else {
        // Tài khoản không yêu cầu 2FA cho đặt lại mật khẩu: Tạo mã OTP bảo mật gửi qua Email
        const code = Math.floor(100000 + Math.random() * 900000).toString();

        // Gửi email qua Supabase Auth
        const client = getSupabaseClient();
        if (client) {
          try {
            await client.auth.resetPasswordForEmail(cleanMail);
          } catch {}
        }

        // Lưu tạm mã OTP vào sessionStorage cục bộ (hết hạn sau 15 phút)
        const expiry = Date.now() + 15 * 60 * 1000;
        sessionStorage.setItem(`spytify_otp_${cleanMail}`, JSON.stringify({ code, expiry, userId: foundUser.id }));

        setCodeSentStep(true);
        setSuccessMsg(t('resetCodeSent'));
      }
    } catch (err: any) {
      setError(err?.message || 'Không thể gửi mã khôi phục lúc này.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!targetResetUser) return;
    if (newPasswordInput.length < 6) {
      setError(t('passwordPlaceholder'));
      return;
    }

    const cleanMail = targetResetUser.email.toLowerCase();
    let valid = false;

    // 1. Nếu tài khoản yêu cầu 2FA khi đặt lại mật khẩu, xác minh bằng mã Google Authenticator (TOTP)
    if (resetUserHas2Fa) {
      try {
        const check2fa = await invoke<[boolean, string | null, string | null]>('auth_get_user_2fa', { userId: targetResetUser.id });
        if (check2fa && check2fa[0] && check2fa[1]) {
          const isValidTotp = await verifyTotp(resetCodeInput.trim(), check2fa[1]);
          if (isValidTotp) {
            valid = true;
          }
        }
      } catch {}
    } else {
      // 2. Nếu không yêu cầu 2FA khi đặt lại mật khẩu, xác minh bằng mã OTP đã gửi qua Email
      const storedOtpRaw = sessionStorage.getItem(`spytify_otp_${cleanMail}`);
      if (storedOtpRaw) {
        try {
          const stored = JSON.parse(storedOtpRaw);
          if (stored.code === resetCodeInput.trim() && Date.now() < stored.expiry) {
            valid = true;
          }
        } catch {}
      }
    }

    if (!valid) {
      setError(
        resetUserHas2Fa
          ? (language === 'vi' ? 'Mã xác thực 2FA (Google Authenticator) không đúng hoặc đã hết hạn.' : 'Invalid or expired 2FA Authenticator code.')
          : t('invalidCode')
      );
      return;
    }

    setLoading(true);
    try {
      // 1. Cập nhật mật khẩu trong SQLite nội bộ bằng Rust
      const [newHash, newSalt] = await invoke<[string, string]>('auth_update_password', {
        userId: targetResetUser.id,
        newPassword: newPasswordInput,
      });

      // 2. Đồng bộ mật khẩu mới lên Supabase Cloud
      if (isSupabaseConfigured()) {
        await cloudResetUserPassword(targetResetUser.id, newHash, newSalt);
      }

      sessionStorage.removeItem(`spytify_otp_${cleanMail}`);
      setSuccessMsg(t('resetSuccess'));
      setTimeout(() => {
        setActiveTab('login');
        setIdentifier(targetResetUser.username || targetResetUser.email);
        setPassword('');
        setCodeSentStep(false);
        setResetUserHas2Fa(false);
        setTargetResetUser(null);
        setSuccessMsg(null);
      }, 2000);
    } catch (err: any) {
      setError(typeof err === 'string' ? err : 'Không thể cập nhật mật khẩu.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickGoogleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = googleEmail.trim().toLowerCase();
    const emailCheck = validateRealEmail(cleanEmail);
    if (!emailCheck.valid) {
      setError(emailCheck.reason || t('emailInvalidCharacters'));
      return;
    }

    setLoading(true);
    try {
      const user = await invoke<User>('auth_google_login', {
        googleEmail: cleanEmail,
        googleName: googleName.trim() || cleanEmail.split('@')[0],
      });

      if (isSupabaseConfigured()) {
        try {
          await cloudRegisterUser(user, cleanEmail, 'GOOGLE_AUTO_KEY', 'GOOGLE_AUTO_SALT');
        } catch (e) {
          console.warn('Could not sync Google login to Supabase:', e);
        }
      }

      saveAccountProfileToStorage(user);
      onSuccess(user);
      onClose();
    } catch (err: unknown) {
      setError(typeof err === 'string' ? err : t('loginFailed'));
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
      saveAccountProfileToStorage(user);
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
      <div className={`w-full ${showRegister2FaSetup ? 'max-w-md' : 'max-w-sm'} bg-[#080808] border border-[#1e1e1e] rounded-2xl p-6 shadow-2xl relative transition-all duration-200 max-h-[92vh] overflow-y-auto no-scrollbar`}>
        {/* Close Button */}
        <button
          onClick={handleModalClose}
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
          <p className="text-[11px] text-[#888] font-mono">{t('sqliteStatus')}</p>
        </div>

        {/* 1.5 MÀN HÌNH XÁC THỰC GOOGLE AUTHENTICATOR (2FA) */}
        {is2FaStep && pending2FaUser ? (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="p-3.5 bg-[#0e0e14] rounded-xl border border-cyan-500/30 text-center space-y-1.5">
              <div className="w-10 h-10 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mx-auto text-cyan-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                Xác thực 2 bước (2FA)
              </h3>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Mở ứng dụng <strong className="text-white">Google Authenticator</strong> trên điện thoại và nhập mã 6 chữ số cho tài khoản <strong className="text-cyan-400">@{pending2FaUser.username}</strong>
              </p>
            </div>

            <form onSubmit={handleVerify2FaLogin} className="space-y-3.5">
              <div>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={twoFactorCodeInput}
                  onChange={(e) => setTwoFactorCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full py-2.5 px-3 text-center text-xl font-mono tracking-[0.3em] font-black rounded-xl bg-[#0e0e12] border border-cyan-500/50 text-cyan-300 outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500/40"
                  autoFocus
                />
              </div>

              {error && (
                <div className="p-2.5 rounded-lg bg-red-900/20 border border-red-500/30 text-red-400 text-[11px] font-mono flex items-center gap-1.5 animate-in fade-in">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={twoFactorCodeInput.length !== 6 || loading}
                className="w-full py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                <span>Xác nhận & Đăng nhập</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIs2FaStep(false);
                  setPending2FaUser(null);
                  setTwoFactorCodeInput('');
                  setError(null);
                }}
                className="w-full py-2 rounded-xl text-xs text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Quay lại đăng nhập</span>
              </button>
            </form>
          </div>
        ) : showRegister2FaSetup && createdUserFor2Fa ? (
          /* MÀN HÌNH ĐỀ XUẤT TẠO 2FA KHI TẠO TÀI KHOẢN */
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Header */}
            <div className="flex items-center gap-3 pb-3 border-b border-white/10">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 border border-cyan-500/30 flex items-center justify-center flex-shrink-0 shadow-lg shadow-cyan-500/10">
                <ShieldCheck className="w-5 h-5 text-cyan-400" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-bold text-white truncate">Bảo mật 2FA Authenticator</h3>
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                    Khuyên dùng
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 font-mono truncate">
                  Tài khoản <strong className="text-white">@{createdUserFor2Fa.username}</strong> đã tạo thành công
                </p>
              </div>
            </div>

            {/* Mục đích ưu tiên: Khôi phục mật khẩu */}
            <div className="p-3 rounded-xl bg-cyan-950/25 border border-cyan-500/25 text-xs text-zinc-300 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-cyan-300">
                <KeyRound className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>Ưu tiên dùng để Reset mật khẩu khi quên</span>
              </div>
              <p className="text-[11px] text-zinc-300 leading-relaxed">
                Khi quên mật khẩu, bạn chỉ cần mở Google Authenticator lấy mã 6 số là đổi được mật khẩu ngay lập tức, không lo kẹt email hay mất tài khoản.
              </p>
            </div>

            {/* Phạm vi áp dụng */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                  Áp dụng xác thực 2FA khi:
                </span>
                <span className="text-[9.5px] text-zinc-500 font-mono">(Tùy chỉnh trong Cài đặt)</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRegister2FaScope('reset_password')}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    register2FaScope === 'reset_password'
                      ? 'bg-cyan-500/15 border-cyan-400/50 text-white shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                      : 'bg-black/40 border-white/5 text-zinc-400 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className={`text-[11px] font-bold ${register2FaScope === 'reset_password' ? 'text-cyan-300' : 'text-zinc-300'}`}>
                      Chỉ khi Reset MK
                    </span>
                    {register2FaScope === 'reset_password' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    ) : (
                      <span className="w-3 h-3 rounded-full border border-white/20 shrink-0" />
                    )}
                  </div>
                  <p className="text-[9.5px] text-zinc-400 leading-tight">
                    (Ưu tiên khuyên dùng) Đăng nhập pass thường nhanh chóng, chỉ cần 2FA khi quên mật khẩu.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setRegister2FaScope('both')}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    register2FaScope === 'both'
                      ? 'bg-emerald-500/15 border-emerald-400/50 text-white shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                      : 'bg-black/40 border-white/5 text-zinc-400 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className={`text-[11px] font-bold ${register2FaScope === 'both' ? 'text-emerald-300' : 'text-zinc-300'}`}>
                      Cả Đăng nhập & MK
                    </span>
                    {register2FaScope === 'both' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <span className="w-3 h-3 rounded-full border border-white/20 shrink-0" />
                    )}
                  </div>
                  <p className="text-[9.5px] text-zinc-400 leading-tight">
                    Bảo vệ tối đa. Yêu cầu mã 6 số cả khi đăng nhập và khi đặt lại mật khẩu.
                  </p>
                </button>
              </div>
            </div>

            {/* Quét mã QR & Khóa thủ công */}
            <div className="p-3 rounded-xl bg-black/50 border border-white/5 space-y-2">
              <div className="flex items-center gap-2 text-xs text-zinc-300">
                <Smartphone className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                <span>Quét mã bằng app <strong className="text-white">Google Authenticator</strong>:</span>
              </div>

              <div className="flex justify-center py-1">
                <div className="p-2.5 rounded-xl bg-white shadow-lg inline-block">
                  <img
                    src={getQrCodeImageUrl(getOtpAuthUrl(createdUserFor2Fa.username, register2FaSecret, 'Spytify'), 160)}
                    alt="2FA QR Code"
                    className="w-[140px] h-[140px] object-contain"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-mono text-zinc-400">Khóa bí mật (Secret Key) để nhập thủ công:</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    readOnly
                    value={register2FaSecret}
                    className="flex-1 py-1 px-2.5 rounded-lg bg-[#07070a] border border-[#262634] text-xs text-cyan-300 font-mono tracking-wider select-all"
                  />
                  <button
                    type="button"
                    onClick={handleCopyRegisterSecret}
                    className="px-2.5 py-1 rounded-lg bg-[#181824] hover:bg-[#222232] border border-[#303044] text-[11px] text-white flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    {register2FaCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{register2FaCopied ? 'Đã sao chép' : 'Sao chép'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Nhập mã xác nhận 6 chữ số */}
            <form onSubmit={handleConfirmRegister2Fa} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase text-zinc-400 mb-1 font-mono">
                  Nhập mã 6 chữ số từ app Authenticator:
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={register2FaCodeInput}
                  onChange={(e) => setRegister2FaCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full py-2 px-3 text-center tracking-[0.3em] font-mono font-bold text-lg bg-[#0f0f0f] text-cyan-300 rounded-lg border border-[#222] focus:border-cyan-400 outline-none"
                  autoFocus
                />
              </div>

              {register2FaError && (
                <div className="p-2.5 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start gap-1.5">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{register2FaError}</span>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSkipRegister2Fa}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer border border-white/5"
                >
                  Để sau (Bỏ qua)
                </button>
                <button
                  type="submit"
                  disabled={register2FaCodeInput.length !== 6 || register2FaLoading}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-black bg-gradient-to-r from-cyan-400 to-emerald-400 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-1.5"
                >
                  {register2FaLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4 text-black" />
                      <span>Kích hoạt & Hoàn tất</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        ) : showGoogleModal ? (
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
        ) : activeTab === 'forgot_password' ? (
          /* 2. MÀN HÌNH QUÊN MẬT KHẨU (RESET PASSWORD) */
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center gap-2 border-b border-[#181818] pb-3">
              <button
                type="button"
                onClick={() => {
                  if (codeSentStep) {
                    setCodeSentStep(false);
                    setResetCodeInput('');
                    setNewPasswordInput('');
                    setResetUserHas2Fa(false);
                    setError(null);
                    setSuccessMsg(null);
                  } else {
                    setActiveTab('login');
                    setError(null);
                    setSuccessMsg(null);
                    setCodeSentStep(false);
                    setTargetResetUser(null);
                    setResetCodeInput('');
                    setNewPasswordInput('');
                    setResetUserHas2Fa(false);
                  }
                }}
                className="p-1 rounded text-[#777] hover:text-white cursor-pointer transition-colors"
                title="Quay lại"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{t('forgotPasswordTitle')}</span>
                </h3>
                <p className="text-[10px] text-[#777]">{t('forgotPasswordDesc')}</p>
              </div>
            </div>

            {error && (
              <div className="p-2.5 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start gap-1.5">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-2.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-start gap-1.5">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            {!codeSentStep ? (
              <form onSubmit={handleSendRecoveryCode} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-[#777] mb-1 font-mono">
                    {language === 'vi' ? 'Email hoặc Tên tài khoản' : 'Email or Username'}
                  </label>
                  <div className="relative flex items-center">
                    <Mail className="w-4 h-4 text-[#555] absolute left-3 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder={selectedSavedAccount?.username ? `${selectedSavedAccount.username} hoặc email...` : 'anhdangtutien hoặc email...'}
                      className="w-full pl-9 pr-3 py-2 bg-[#0f0f0f] text-white text-xs rounded-lg border border-[#222] focus:border-cyan-400 outline-none transition-colors font-sans"
                    />
                  </div>
                  {selectedSavedAccount && (
                    <p className="mt-1 text-[10px] text-zinc-400 font-mono">
                      Tài khoản đang chọn: <strong className="text-cyan-400">@{selectedSavedAccount.username}</strong>
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs uppercase rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>{t('sendResetCode')}</span>}
                </button>
              </form>
            ) : (
              <form onSubmit={handleConfirmResetPassword} className="space-y-3">
                {resetUserHas2Fa ? (
                  <div className="p-3.5 rounded-xl bg-[#091520] border border-cyan-500/40 text-cyan-200 text-xs space-y-2 shadow-lg">
                    <div className="flex items-center justify-between">
                      <span className="font-bold flex items-center gap-1.5 text-cyan-300">
                        <ShieldCheck className="w-4 h-4 text-cyan-400" />
                        <span>Xác minh 2 lớp (2FA)</span>
                      </span>
                      <span className="text-[9px] font-mono text-cyan-400/80 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/30">
                        Google Authenticator
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-300 leading-relaxed">
                      Tài khoản của bạn đã bật bảo mật 2 lớp. Vui lòng mở ứng dụng <strong>Google Authenticator</strong> hoặc <strong>Microsoft Authenticator</strong> trên điện thoại và nhập mã xác thực 6 chữ số đang chạy.
                    </p>
                    {targetResetUser?.email && (
                      <div className="pt-1 flex items-center justify-between border-t border-cyan-500/20">
                        <button
                          type="button"
                          onClick={() => {
                            setResetUserHas2Fa(false);
                            setError(null);
                          }}
                          className="text-[10px] text-cyan-400 hover:text-cyan-300 font-mono flex items-center gap-1 cursor-pointer"
                        >
                          <Mail className="w-3 h-3" />
                          <span>Chuyển sang xác nhận bằng Email</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCodeSentStep(false);
                            setResetCodeInput('');
                            setNewPasswordInput('');
                            setResetUserHas2Fa(false);
                            setError(null);
                            setSuccessMsg(null);
                          }}
                          className="text-[10px] text-zinc-400 hover:text-white cursor-pointer font-mono"
                        >
                          ← Đổi tài khoản
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-emerald-950/25 border border-emerald-500/30 text-emerald-200 text-xs space-y-2 shadow-lg">
                    <div className="flex items-center justify-between">
                      <span className="font-bold flex items-center gap-1.5 text-emerald-400">
                        <Mail className="w-4 h-4 text-emerald-400" />
                        <span>Xác thực qua Email</span>
                      </span>
                      <span className="text-[9px] font-mono text-emerald-400/80 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                        OTP 15 min
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-300 leading-relaxed">
                      Mã xác nhận 6 chữ số đã được gửi tới email <strong>{targetResetUser?.email}</strong>{targetResetUser?.username ? <> (Tài khoản: <strong className="text-cyan-400">@{targetResetUser.username}</strong>)</> : null}. Vui lòng kiểm tra hộp thư đến (và thư mục Spam/Rác) để lấy mã xác nhận.
                    </p>
                    <div className="pt-1 flex items-center justify-between border-t border-white/5">
                      {targetResetUser?.two_factor_secret ? (
                        <button
                          type="button"
                          onClick={() => {
                            setResetUserHas2Fa(true);
                            setError(null);
                          }}
                          className="text-[10px] text-cyan-400 hover:text-cyan-300 font-mono flex items-center gap-1 cursor-pointer"
                        >
                          <ShieldCheck className="w-3 h-3" />
                          <span>Dùng Google Authenticator (Xác thực tức thì)</span>
                        </button>
                      ) : <span />}
                      <button
                        type="button"
                        onClick={() => {
                          setCodeSentStep(false);
                          setResetCodeInput('');
                          setNewPasswordInput('');
                          setResetUserHas2Fa(false);
                          setError(null);
                          setSuccessMsg(null);
                        }}
                        className="text-[10px] text-zinc-400 hover:text-white cursor-pointer font-mono"
                      >
                        ← Đổi tài khoản
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-semibold uppercase text-[#777] mb-1 font-mono">
                    {resetUserHas2Fa ? 'Mã 2FA Google Authenticator (6 chữ số)' : t('enterResetCode')}
                  </label>
                  <input
                    type="text"
                    required
                    inputMode="numeric"
                    maxLength={6}
                    value={resetCodeInput}
                    onChange={(e) => setResetCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    autoFocus
                    className="w-full py-2.5 px-3 text-center tracking-[0.3em] font-mono font-bold text-lg bg-[#0f0f0f] text-cyan-300 rounded-lg border border-[#222] focus:border-cyan-400 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase text-[#777] mb-1 font-mono">
                    {t('newPassword')}
                  </label>
                  <div className="relative flex items-center">
                    <Lock className="w-4 h-4 text-[#555] absolute left-3 pointer-events-none" />
                    <input
                      type="password"
                      required
                      value={newPasswordInput}
                      onChange={(e) => setNewPasswordInput(e.target.value)}
                      placeholder={t('passwordPlaceholder')}
                      className="w-full pl-9 pr-3 py-2 bg-[#0f0f0f] text-white text-xs rounded-lg border border-[#222] focus:border-cyan-400 outline-none transition-colors"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs uppercase rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>{t('confirmReset')}</span>}
                </button>
              </form>
            )}
          </div>
        ) : (
          /* 3. MÀN HÌNH ĐĂNG NHẬP / ĐĂNG KÝ VỚI LƯU PROFILE */
          <div>
            {/* Google Login Button */}
            <button
              type="button"
              onClick={() => { setError(null); setSuccessMsg(null); setShowGoogleModal(true); }}
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

            {/* DANH SÁCH CÁC TÀI KHOẢN ĐÃ LƯU TRÊN MÁY (Account Switcher) */}
            {activeTab === 'login' && savedAccounts.length > 0 && (
              <div className="mb-4 p-2.5 rounded-xl bg-[#0e0e14] border border-[#20202c]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
                    {t('savedAccounts')} ({savedAccounts.length})
                  </span>
                  {selectedSavedAccount && (
                    <button
                      type="button"
                      onClick={handleUseOtherAccount}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 font-mono cursor-pointer flex items-center gap-1"
                    >
                      <PlusCircle className="w-3 h-3" />
                      <span>{t('useOtherAccount')}</span>
                    </button>
                  )}
                </div>

                <div className="space-y-1.5 max-h-36 overflow-y-auto no-scrollbar">
                  {savedAccounts.map(acc => {
                    const isSelected = selectedSavedAccount?.id === acc.id;
                    return (
                      <div
                        key={acc.id}
                        onClick={() => handlePickSavedAccount(acc)}
                        className={`p-1.5 rounded-lg border flex items-center justify-between gap-2.5 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-cyan-500/15 border-cyan-500/50 text-white'
                            : 'bg-black/40 border-white/5 hover:bg-white/5 text-zinc-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-lg overflow-hidden bg-zinc-800 border border-white/10 flex items-center justify-center font-bold text-xs flex-shrink-0 text-cyan-400">
                            {acc.avatar ? (
                              <img src={acc.avatar} alt="avatar" className="w-full h-full object-cover" />
                            ) : (
                              <span>{(acc.displayName || acc.username || 'U').charAt(0).toUpperCase()}</span>
                            )}
                          </div>
                          <div className="truncate">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-bold truncate leading-tight">{acc.displayName || acc.username}</p>
                              {acc.savedPassword && (
                                <span className="text-[8.5px] font-mono text-emerald-400 bg-emerald-950/60 px-1 py-0.2 rounded border border-emerald-500/30 flex items-center gap-0.5" title="Đã lưu mật khẩu">
                                  <Lock className="w-2.5 h-2.5" />
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] font-mono text-zinc-500 truncate">@{acc.username}</p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => handleRemoveSavedAccount(e, acc.id)}
                          className="p-1 rounded text-zinc-600 hover:text-red-400 hover:bg-red-500/10 cursor-pointer transition-colors"
                          title={t('removeSavedAccount')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tabs: Login / Register */}
            <div className="flex border-b border-[#181818] mb-4">
              <button
                onClick={() => { setActiveTab('login'); setError(null); setSuccessMsg(null); }}
                className={`flex-1 py-1.5 text-xs font-semibold uppercase tracking-wider text-center transition-colors cursor-pointer ${
                  activeTab === 'login'
                    ? 'text-white border-b-2 border-[#ffffff]'
                    : 'text-[#666] hover:text-[#999]'
                }`}
              >
                {t('loginTab')}
              </button>
              <button
                onClick={() => { setActiveTab('register'); setSelectedSavedAccount(null); setError(null); setSuccessMsg(null); }}
                className={`flex-1 py-1.5 text-xs font-semibold uppercase tracking-wider text-center transition-colors cursor-pointer ${
                  activeTab === 'register'
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
              {activeTab === 'register' ? (
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
                !selectedSavedAccount && (
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
                )
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#777] font-mono">
                    {t('password')}
                  </label>
                  {activeTab === 'login' && (
                    <button
                      type="button"
                      onClick={handleOpenForgotPassword}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 font-mono cursor-pointer"
                    >
                      {t('forgotPassword')}
                    </button>
                  )}
                </div>
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

                {/* Ô tick Lưu / Ghi nhớ mật khẩu */}
                <div className="flex items-center justify-between mt-2 select-none">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={rememberPassword}
                      onChange={(e) => setRememberPassword(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border border-[#333] bg-[#121218] text-[#ff2a55] focus:ring-0 cursor-pointer accent-[#ff2a55]"
                    />
                    <span className="text-[11px] text-[#888] group-hover:text-white transition-colors">
                      {t('rememberPassword')}
                    </span>
                  </label>
                  {selectedSavedAccount?.savedPassword && (
                    <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      <span>{t('savedPasswordBadge')}</span>
                    </span>
                  )}
                </div>

                {/* Đề xuất tạo 2FA Authenticator khi tạo tài khoản */}
                {activeTab === 'register' && (
                  <div className="mt-3 p-2.5 rounded-xl bg-cyan-950/25 border border-cyan-500/30 select-none">
                    <label className="flex items-start gap-2.5 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={setup2FaOnRegister}
                        onChange={(e) => setSetup2FaOnRegister(e.target.checked)}
                        className="w-4 h-4 mt-0.5 rounded border border-cyan-500/40 bg-[#0f0f14] text-cyan-400 focus:ring-0 cursor-pointer accent-cyan-400"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-cyan-300 group-hover:text-cyan-200 transition-colors">
                            Cài đặt 2FA Authenticator
                          </span>
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                            Khuyên dùng
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-400 mt-0.5 leading-tight">
                          Ưu tiên dùng để Reset mật khẩu khi quên. Bảo mật khi đăng nhập tự tùy chỉnh trong Cài đặt.
                        </p>
                      </div>
                    </label>
                  </div>
                )}
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
                    <span>
                      {activeTab === 'register'
                        ? (setup2FaOnRegister ? 'Tạo tài khoản & Thiết lập 2FA' : t('createAccountNow'))
                        : selectedSavedAccount
                        ? `${t('quickLogin')} (@${selectedSavedAccount.username})`
                        : t('loginTab')}
                    </span>
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
