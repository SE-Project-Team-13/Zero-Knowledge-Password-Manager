import { Platform } from 'react-native';

// Prefer explicit env override first.
// Examples:
// - Web: EXPO_PUBLIC_API_URL=http://localhost:3001
// - Android emulator: EXPO_PUBLIC_API_URL=http://10.0.2.2:3001
// - iOS simulator: EXPO_PUBLIC_API_URL=http://localhost:3001
const envApiUrl = process.env.EXPO_PUBLIC_API_URL;

const devDefaultApiUrl = Platform.OS === 'android'
  ? 'http://10.0.2.2:3001'
  : 'http://localhost:3001';

export const API_URL = envApiUrl || devDefaultApiUrl;

// Device identifier key
export const DEVICE_ID_KEY = 'device_id';
