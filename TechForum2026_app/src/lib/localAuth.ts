export interface LocalUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  avatar: string;
  bio: string;
  phone?: string;
  role?: string;
  isPrivate?: boolean;
}
interface LocalUserStored extends Partial<LocalUser> {
  id?: string;
  name?: string;
  email?: string;
  avatar?: string;
  bio?: string;
  phone?: string;
  role?: string;
  isPrivate?: boolean;
  // Legacy format migration support
  password?: string;
}
type LocalPublicUser = Omit<LocalUser, 'passwordHash' | 'passwordSalt'>;

const LOCAL_USERS_KEY = 'techforum_local_users_v1';
const LOCAL_SESSION_KEY = 'techforum_local_session_user_id';
const PASSWORD_HASH_ITERATIONS = 200_000;
const SEED_SALT_BASE64 = 'dGZfc2VlZF9zYWx0X3Yx';
const SEED_HASH_BASE64 = 'OeemIs8BEE+CPMGHSeo6oSSJnMv+IfdZECPyy9zXXMo=';

export function isLocalAuthFallbackEnabled(): boolean {
  const explicit = String(import.meta.env.VITE_ENABLE_LOCAL_FALLBACK ?? '').trim().toLowerCase();
  if (explicit === 'true') return true;
  if (explicit === 'false') return false;
  // Default: ON. The APK ships standalone (no bundled backend),
  // so local auth must work when the network/backend is unreachable.
  return true;
}

const seedUsers: LocalUser[] = [
  {
    id: 'u_local_seed_1',
    name: 'Дмитрий Волков',
    email: 'v@tech.com',
    passwordHash: SEED_HASH_BASE64,
    passwordSalt: SEED_SALT_BASE64,
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Dmitry',
    bio: 'Tech Lead',
    role: 'Участник',
    isPrivate: false,
  },
];

function toPublicUser(user: LocalUser): LocalPublicUser {
  const { passwordHash: _passwordHash, passwordSalt: _passwordSalt, ...rest } = user;
  return rest;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function hasSubtleCrypto(): boolean {
  return typeof globalThis !== 'undefined' && !!globalThis.crypto && !!globalThis.crypto.subtle;
}

// Insecure but functional fallback when Web Crypto isn't available
// (e.g. file:// origin, http:// without localhost, ancient WebView).
// Uses a simple iterative SHA-256-like loop in pure JS so users can still register.
function fallbackHashSync(password: string, saltBase64: string): string {
  const PRIME_A = 0x9E3779B1; // golden-ratio constant
  const PRIME_B = 0x85EBCA77;
  const PRIME_C = 0xC2B2AE3D;
  const data = `${saltBase64}::${password}`;
  let h1 = 0xDEADBEEF >>> 0;
  let h2 = 0x41C6CE57 >>> 0;
  for (let iter = 0; iter < 5000; iter++) {
    for (let i = 0; i < data.length; i++) {
      const ch = data.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, PRIME_A) >>> 0;
      h2 = Math.imul(h2 ^ ch, PRIME_B) >>> 0;
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), PRIME_C) >>> 0;
    h2 = Math.imul(h2 ^ (h2 >>> 13), PRIME_C) >>> 0;
  }
  const bytes = new Uint8Array(8);
  for (let i = 0; i < 4; i++) {
    bytes[i]     = (h1 >>> ((3 - i) * 8)) & 0xff;
    bytes[i + 4] = (h2 >>> ((3 - i) * 8)) & 0xff;
  }
  return 'fallback:' + bytesToBase64(bytes);
}

async function derivePasswordHash(password: string, saltBase64: string): Promise<string> {
  if (!hasSubtleCrypto()) return fallbackHashSync(password, saltBase64);
  const subtle = globalThis.crypto.subtle;
  const keyMaterial = await subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await subtle.deriveBits({
    name: 'PBKDF2',
    hash: 'SHA-256',
    salt: base64ToBytes(saltBase64),
    iterations: PASSWORD_HASH_ITERATIONS,
  }, keyMaterial, 256);
  return bytesToBase64(new Uint8Array(bits));
}

async function createPasswordDigest(password: string): Promise<{ hash: string; salt: string }> {
  let salt: string;
  if (hasSubtleCrypto()) {
    salt = bytesToBase64(globalThis.crypto.getRandomValues(new Uint8Array(16)));
  } else {
    // Fallback random source (Math.random) — only used when Web Crypto isn't available.
    const buf = new Uint8Array(16);
    for (let i = 0; i < buf.length; i++) buf[i] = Math.floor(Math.random() * 256);
    salt = bytesToBase64(buf);
  }
  const hash = await derivePasswordHash(password, salt);
  return { hash, salt };
}

function safeString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function normalizeStoredUsers(input: unknown[]): LocalUserStored[] {
  return input
    .map((item): LocalUserStored | null => {
      if (!item || typeof item !== 'object') return null;
      const candidate = item as Record<string, unknown>;
      const id = safeString(candidate.id);
      const email = safeString(candidate.email);
      const name = safeString(candidate.name);
      if (!id || !email || !name) return null;
      const normalized: LocalUserStored = {
        id,
        email,
        name,
        avatar: safeString(candidate.avatar) || buildAvatar(name),
        bio: safeString(candidate.bio) || '',
        phone: safeString(candidate.phone),
        role: safeString(candidate.role),
        isPrivate: typeof candidate.isPrivate === 'boolean' ? candidate.isPrivate : false,
        password: safeString(candidate.password),
        passwordHash: safeString(candidate.passwordHash),
        passwordSalt: safeString(candidate.passwordSalt),
      };
      return normalized;
    })
    .filter((item): item is LocalUserStored => item !== null);
}

function readLocalUsers(): LocalUserStored[] {
  try {
    const raw = localStorage.getItem(LOCAL_USERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return normalizeStoredUsers(parsed);
  } catch {
    return [];
  }
}

function writeLocalUsers(users: LocalUserStored[]): void {
  localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
}

function ensureLocalUsers(): LocalUserStored[] {
  const users = readLocalUsers();
  if (users.length > 0) return users;
  writeLocalUsers(seedUsers);
  return [...seedUsers];
}

function normalizeIdentifier(value: string): string {
  return value.trim().toLowerCase();
}

function normalizePhone(value: string): string {
  return value.trim();
}

function buildPhoneSyntheticEmail(phone: string): string {
  const safe = phone.replace(/[^\d+]/g, '').replace(/\+/g, 'plus') || `phone_${Date.now()}`;
  return `${safe}@phone.local`;
}

function buildAvatar(name: string): string {
  const seed = encodeURIComponent(name || `user_${Date.now()}`);
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
}

function asModernLocalUser(user: LocalUserStored): LocalUser | null {
  if (
    typeof user.id !== 'string'
    || typeof user.name !== 'string'
    || typeof user.email !== 'string'
    || typeof user.avatar !== 'string'
    || typeof user.bio !== 'string'
    || typeof user.passwordHash !== 'string'
    || typeof user.passwordSalt !== 'string'
  ) {
    return null;
  }
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    bio: user.bio,
    phone: user.phone,
    role: user.role,
    isPrivate: user.isPrivate,
    passwordHash: user.passwordHash,
    passwordSalt: user.passwordSalt,
  };
}

function toPublicUserFromStored(user: LocalUserStored): LocalPublicUser | null {
  if (
    typeof user.id !== 'string'
    || typeof user.name !== 'string'
    || typeof user.email !== 'string'
  ) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar || buildAvatar(user.name),
    bio: user.bio || '',
    phone: user.phone,
    role: user.role,
    isPrivate: typeof user.isPrivate === 'boolean' ? user.isPrivate : false,
  };
}

async function upgradeLegacyUsersIfNeeded(users: LocalUserStored[]): Promise<LocalUser[]> {
  let changed = false;
  const upgraded: LocalUser[] = [];
  for (const entry of users) {
    const modern = asModernLocalUser(entry);
    if (modern) {
      upgraded.push(modern);
      continue;
    }
    if (
      typeof entry.id === 'string'
      && typeof entry.name === 'string'
      && typeof entry.email === 'string'
      && typeof entry.password === 'string'
    ) {
      const { hash, salt } = await createPasswordDigest(entry.password);
      upgraded.push({
        id: entry.id,
        name: entry.name,
        email: entry.email,
        avatar: entry.avatar || buildAvatar(entry.name),
        bio: entry.bio || '',
        phone: entry.phone,
        role: entry.role,
        isPrivate: entry.isPrivate,
        passwordHash: hash,
        passwordSalt: salt,
      });
      changed = true;
    }
  }
  if (changed) writeLocalUsers(upgraded);
  return upgraded;
}

export function getCurrentLocalUser(): LocalPublicUser | null {
  const sessionUserId = localStorage.getItem(LOCAL_SESSION_KEY);
  if (!sessionUserId) return null;
  const storedUsers = ensureLocalUsers();
  const stored = storedUsers.find((entry) => entry.id === sessionUserId);
  if (!stored) return null;

  const modern = asModernLocalUser(stored);
  if (modern) return toPublicUser(modern);

  void upgradeLegacyUsersIfNeeded(storedUsers).catch(() => {});
  return toPublicUserFromStored(stored);
}

export function clearLocalSession(): void {
  localStorage.removeItem(LOCAL_SESSION_KEY);
}

export async function registerLocalUser(input: {
  name: string;
  identifier: string;
  password: string;
  method: 'email' | 'phone';
}): Promise<LocalPublicUser> {
  const users = await upgradeLegacyUsersIfNeeded(ensureLocalUsers());
  const name = input.name.trim();
  const password = input.password.trim();
  const identifier = input.identifier.trim();

  if (!name) throw new Error('Укажите имя');
  if (!identifier) throw new Error(input.method === 'email' ? 'Укажите email' : 'Укажите телефон');
  if (!password) throw new Error('Укажите пароль');

  const email = input.method === 'email' ? normalizeIdentifier(identifier) : buildPhoneSyntheticEmail(identifier);
  const phone = input.method === 'phone' ? normalizePhone(identifier) : '';

  const emailExists = users.some((entry) => normalizeIdentifier(entry.email) === email);
  if (emailExists) throw new Error('Пользователь уже существует');

  if (phone) {
    const phoneExists = users.some((entry) => normalizePhone(entry.phone || '') === phone);
    if (phoneExists) throw new Error('Пользователь уже существует');
  }

  const { hash, salt } = await createPasswordDigest(password);
  const user: LocalUser = {
    id: `u_local_${Date.now()}`,
    name,
    email,
    passwordHash: hash,
    passwordSalt: salt,
    phone: phone || undefined,
    avatar: buildAvatar(name),
    bio: '',
    role: 'Участник',
    isPrivate: false,
  };

  users.push(user);
  writeLocalUsers(users);
  localStorage.setItem(LOCAL_SESSION_KEY, user.id);

  return toPublicUser(user);
}

export async function loginLocalUser(input: {
  identifier: string;
  password: string;
}): Promise<LocalPublicUser> {
  const users = await upgradeLegacyUsersIfNeeded(ensureLocalUsers());
  const identifier = input.identifier.trim();
  const password = input.password.trim();

  if (!identifier) throw new Error('Укажите email или телефон');
  if (!password) throw new Error('Укажите пароль');

  const normalizedIdentifier = normalizeIdentifier(identifier);
  let matchedUser: LocalUser | null = null;
  for (const entry of users) {
    const byEmail = normalizeIdentifier(entry.email) === normalizedIdentifier;
    const byPhone = normalizePhone(entry.phone || '') === identifier;
    if (!byEmail && !byPhone) continue;
    const hash = await derivePasswordHash(password, entry.passwordSalt);
    if (hash === entry.passwordHash) {
      matchedUser = entry;
      break;
    }
  }

  if (!matchedUser) throw new Error('Неверные данные');
  localStorage.setItem(LOCAL_SESSION_KEY, matchedUser.id);
  return toPublicUser(matchedUser);
}

export function updateLocalUser(
  userId: string,
  patch: { name?: string; email?: string; phone?: string; bio?: string },
): LocalPublicUser | null {
  const storedUsers = ensureLocalUsers();
  const index = storedUsers.findIndex((entry) => entry.id === userId);
  if (index === -1) return null;

  const current = storedUsers[index];
  const currentPublic = toPublicUserFromStored(current);
  if (!currentPublic) return null;

  const nextName = typeof patch.name === 'string' && patch.name.trim() ? patch.name.trim() : currentPublic.name;
  const nextEmail =
    typeof patch.email === 'string' && patch.email.trim()
      ? normalizeIdentifier(patch.email)
      : currentPublic.email;
  const nextPhone =
    typeof patch.phone === 'string'
      ? patch.phone.trim() || undefined
      : currentPublic.phone;
  const nextBio = typeof patch.bio === 'string' ? patch.bio : currentPublic.bio;

  const duplicateEmail = storedUsers.some(
    (entry, idx) =>
      idx !== index
      && typeof entry.email === 'string'
      && normalizeIdentifier(entry.email) === nextEmail,
  );
  if (duplicateEmail) throw new Error('Пользователь уже существует');

  const duplicatePhone = nextPhone
    ? storedUsers.some(
        (entry, idx) => idx !== index && normalizePhone(entry.phone || '') === nextPhone,
      )
    : false;
  if (duplicatePhone) throw new Error('Пользователь уже существует');

  const updated: LocalUserStored = {
    ...current,
    name: nextName,
    email: nextEmail,
    phone: nextPhone,
    bio: nextBio,
    avatar: current.avatar || buildAvatar(nextName),
  };

  storedUsers[index] = updated;
  writeLocalUsers(storedUsers);
  return toPublicUserFromStored(updated);
}
