import { useCallback } from "react";
import { useVault, type DecryptedEntry } from "@/context/VaultContext";
import { formatDistanceToNow } from "date-fns";

export function usePasswordAging() {
  const { decryptedEntries, snoozeEntry } = useVault();

  const getLastUpdatedMs = useCallback((entry: DecryptedEntry) => {
    const candidates = [
      entry.lastUpdated,
      entry.updatedAt,
      entry.createdAt,
    ].filter(Boolean) as string[];
    
    for (const value of candidates) {
      const parsed = new Date(value).getTime();
      if (!Number.isNaN(parsed)) return parsed;
    }
    return NaN;
  }, []);

  const isPasswordOld = useCallback((entry: DecryptedEntry) => {
    const last = getLastUpdatedMs(entry);
    if (Number.isNaN(last)) return false;
    const ageDays = (Date.now() - last) / (1000 * 60 * 60 * 24);
    return ageDays >= 365;
  }, [getLastUpdatedMs]);

  const isSnoozed = useCallback((entry: DecryptedEntry) => {
    if (!entry.reminderSnoozeUntil) return false;
    return new Date(entry.reminderSnoozeUntil).getTime() > Date.now();
  }, []);

  const agingEntries = decryptedEntries.filter(
    (entry) => isPasswordOld(entry) && !isSnoozed(entry),
  );

  return {
    agingEntries,
    isPasswordOld,
    isSnoozed,
    getLastUpdatedMs,
    snoozeEntry
  };
}
