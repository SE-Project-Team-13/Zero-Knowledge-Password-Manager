import { useCallback } from 'react';
import { useVaultStore, type VaultEntryLocal } from '../store/vaultStore';
import { useAuthStore } from '../store/authStore';

export function usePasswordAging() {
  const { entries, snoozeEntry } = useVaultStore();
  const { masterKey, userId } = useAuthStore();

  const getLastUpdatedMs = useCallback((entry: VaultEntryLocal) => {
    const candidates = [
      entry.updatedAt,
      entry.createdAt,
    ].filter(Boolean) as string[];
    
    for (const value of candidates) {
      const parsed = new Date(value).getTime();
      if (!Number.isNaN(parsed)) return parsed;
    }
    // Log warning if both dates are invalid
    console.warn('[PasswordAging] Invalid dates for entry:', entry.id, entry.updatedAt, entry.createdAt);
    return NaN;
  }, []);

  const isPasswordOld = useCallback((entry: VaultEntryLocal) => {
    const last = getLastUpdatedMs(entry);
    if (Number.isNaN(last)) return false;
    const ageDays = (Date.now() - last) / (1000 * 60 * 60 * 24);
    return ageDays >= 365;
  }, [getLastUpdatedMs]);

  const isSnoozed = useCallback((entry: VaultEntryLocal) => {
    if (!entry.reminderSnoozeUntil) return false;
    return new Date(entry.reminderSnoozeUntil).getTime() > Date.now();
  }, []);

  const agingEntries = entries.filter(
    (entry) => !entry.isDeleted && isPasswordOld(entry) && !isSnoozed(entry),
  );

  const handleSnooze = useCallback((id: string) => {
    if (masterKey && userId) {
      snoozeEntry(id, masterKey, userId);
    }
  }, [masterKey, userId, snoozeEntry]);

  return {
    agingEntries,
    isPasswordOld,
    isSnoozed,
    getLastUpdatedMs,
    snoozeEntry: handleSnooze,
  };
}
