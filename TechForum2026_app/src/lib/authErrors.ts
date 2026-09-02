export type AuthErrorTarget = 'name' | 'identifier' | 'password' | 'form';

export interface AuthErrorPresentation {
  message: string;
  target: AuthErrorTarget;
  diagnosticCode: string;
}

const NETWORK_PATTERN = /failed to fetch|networkerror|load failed|cors|typeerror|timeout|timed out|abort|backend_invalid_response|unexpected token/i;
const DIAGNOSTIC_STORAGE_KEY = 'techforum_last_auth_diagnostic';

export function mapAuthServerError(code: string, issueMessage = ''): AuthErrorPresentation {
  const normalizedCode = String(code || '').trim();
  const safeIssue = String(issueMessage || '').trim();
  const known: Record<string, AuthErrorPresentation> = {
    invalid_body: {
      message: safeIssue || 'Проверьте введённые данные: email должен быть корректным, пароль — не короче 6 символов.',
      target: 'identifier',
      diagnosticCode: 'invalid_body',
    },
    user_create_failed: {
      message: 'Не удалось создать аккаунт. Попробуйте ещё раз позже.',
      target: 'form',
      diagnosticCode: 'user_create_failed',
    },
    invalid_credentials: {
      message: 'Неверный email, телефон или пароль. Проверьте данные и попробуйте снова.',
      target: 'identifier',
      diagnosticCode: 'invalid_credentials',
    },
    user_not_found: {
      message: 'Неверный email, телефон или пароль. Проверьте данные и попробуйте снова.',
      target: 'identifier',
      diagnosticCode: 'user_not_found',
    },
    wrong_password: {
      message: 'Неверный email, телефон или пароль. Проверьте данные и попробуйте снова.',
      target: 'password',
      diagnosticCode: 'wrong_password',
    },
    email_taken: {
      message: 'Аккаунт с таким email уже есть. Переключитесь на вход или используйте другой email.',
      target: 'identifier',
      diagnosticCode: 'email_taken',
    },
  };
  if (known[normalizedCode]) return known[normalizedCode];
  if (safeIssue && /[А-Яа-яЁё]/.test(safeIssue)) {
    return { message: safeIssue, target: 'form', diagnosticCode: normalizedCode || 'server_issue' };
  }
  return {
    message: 'Не удалось выполнить вход. Проверьте данные и попробуйте ещё раз.',
    target: 'form',
    diagnosticCode: normalizedCode || 'unknown_server_error',
  };
}

export function presentAuthException(error: unknown): AuthErrorPresentation {
  const rawMessage = error instanceof Error ? error.message : String(error || '');
  if (NETWORK_PATTERN.test(rawMessage)) {
    return {
      message: 'Не удалось связаться с сервером. Проверьте подключение к интернету и повторите попытку.',
      target: 'form',
      diagnosticCode: /timeout|timed out|abort/i.test(rawMessage) ? 'network_timeout' : 'network_unavailable',
    };
  }
  if (/invalid_credentials|wrong[_ ]?password|user[_ ]?not[_ ]?found|неверные/i.test(rawMessage)) {
    return {
      message: 'Неверный email, телефон или пароль. Проверьте данные и попробуйте снова.',
      target: /password|парол/i.test(rawMessage) ? 'password' : 'identifier',
      diagnosticCode: 'invalid_credentials',
    };
  }
  if (/already[_ ]?exists|duplicate|уже существует/i.test(rawMessage)) {
    return {
      message: 'Аккаунт с такими данными уже существует. Переключитесь на вход.',
      target: 'identifier',
      diagnosticCode: 'account_exists',
    };
  }
  if (/password.*(short|weak|min)|укажите пароль/i.test(rawMessage)) {
    return {
      message: 'Используйте пароль не короче 6 символов.',
      target: 'password',
      diagnosticCode: 'weak_password',
    };
  }
  if (/[А-Яа-яЁё]/.test(rawMessage)) {
    return { message: rawMessage, target: 'form', diagnosticCode: 'localized_error' };
  }
  return {
    message: 'Не удалось выполнить вход. Попробуйте ещё раз.',
    target: 'form',
    diagnosticCode: 'unknown_auth_error',
  };
}

export function recordAuthDiagnostic(error: unknown, presentation: AuthErrorPresentation): void {
  if (typeof window === 'undefined') return;
  const rawMessage = error instanceof Error ? error.message : String(error || '');
  const payload = {
    occurredAt: new Date().toISOString(),
    code: presentation.diagnosticCode,
    errorName: error instanceof Error ? error.name : 'UnknownError',
    technicalMessage: rawMessage.slice(0, 160),
  };
  try { window.localStorage.setItem(DIAGNOSTIC_STORAGE_KEY, JSON.stringify(payload)); } catch { /* storage unavailable */ }
}

export function readLastAuthDiagnostic(): { occurredAt: string; code: string; errorName: string; technicalMessage: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = JSON.parse(window.localStorage.getItem(DIAGNOSTIC_STORAGE_KEY) || 'null');
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
}
