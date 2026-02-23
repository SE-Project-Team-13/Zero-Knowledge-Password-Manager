import { Platform } from 'react-native';

// Prefer explicit env override first.
// Examples:
// - Web: EXPO_PUBLIC_API_URL=http://localhost:3001
// - Android emulator: EXPO_PUBLIC_API_URL=http://10.0.2.2:3001
// - iOS simulator: EXPO_PUBLIC_API_URL=http://localhost:3001
const envApiUrlRaw = process.env.EXPO_PUBLIC_API_URL;

function normalizeApiUrl(raw?: string): string | null {
  if (!raw) return null;

  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return null;

  // Common misconfig: ":3001" (missing host + scheme). Treat as localhost.
  let candidate = trimmed;
  if (/^:\d+$/.test(candidate)) {
    candidate = `http://localhost${candidate}`;
  }

  // If scheme is missing (e.g. "localhost:3001"), default to http.
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(candidate)) {
    candidate = `http://${candidate}`;
  }

  try {
    // Validates URL shape (scheme/host/port).
    // Keep full candidate to allow optional paths like "https://example.com/api".
    // eslint-disable-next-line no-new
    new URL(candidate);
    return candidate;
  } catch {
    return null;
  }
}

const devDefaultApiUrl = Platform.OS === 'android'
  ? 'http://10.0.2.2:3001'
  : 'http://localhost:3001';

const normalizedEnvApiUrl = normalizeApiUrl(envApiUrlRaw);
if (__DEV__ && envApiUrlRaw && !normalizedEnvApiUrl) {
  // eslint-disable-next-line no-console
  console.warn('[config] Ignoring invalid EXPO_PUBLIC_API_URL:', envApiUrlRaw);
}

export const API_URL = normalizedEnvApiUrl || devDefaultApiUrl;

// Device identifier key
export const DEVICE_ID_KEY = 'device_id';
