import { AppState } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { useVaultStore } from '../store/vaultStore';

const BACKGROUND_SYNC_INTERVAL_MS = 3 * 60 * 1000; // full sync every 3 minutes
// Don't re-download vault if app was only backgrounded briefly.
const MIN_FULL_SYNC_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes between full vault pulls

let timer: ReturnType<typeof setInterval> | null = null;
let appStateSubscription: { remove: () => void } | null = null;
let isSyncRunning = false;
let lastFullSyncTime = 0;

async function runSync(reason: 'interval' | 'app_active') {
    if (isSyncRunning) return;

    const { isAuthenticated, userId, masterKey } = useAuthStore.getState();
    if (!isAuthenticated || !userId || !masterKey) return;

    isSyncRunning = true;
    try {
        if (reason === 'app_active') {
            // On app resume: always flush the offline queue (fast, local-first),
            // but only do a full vault pull if enough time has passed.
            const timeSinceLastSync = Date.now() - lastFullSyncTime;
            if (timeSinceLastSync < MIN_FULL_SYNC_INTERVAL_MS) {
                console.log('[BackgroundSync] App active — skipping full sync, only flushing queue', {
                    secondsUntilNextSync: Math.ceil((MIN_FULL_SYNC_INTERVAL_MS - timeSinceLastSync) / 1000),
                });
                await useVaultStore.getState().flushSyncQueue(masterKey, userId);
                return;
            }
        }

        console.log('[BackgroundSync] Running full sync', { reason, userId });
        await useVaultStore.getState().flushSyncQueue(masterKey, userId);
        await useVaultStore.getState().loadVault(masterKey, userId);
        lastFullSyncTime = Date.now();
        console.log('[BackgroundSync] Full sync complete', { reason });
    } catch (error) {
        console.error('[BackgroundSync] Sync failed', error);
    } finally {
        isSyncRunning = false;
    }
}

export const BackgroundSyncService = {
    start() {
        if (timer) return;

        // Reset so first app-active after login always does a full pull.
        lastFullSyncTime = 0;

        console.log('[BackgroundSync] Started');
        timer = setInterval(() => {
            void runSync('interval');
        }, BACKGROUND_SYNC_INTERVAL_MS);

        appStateSubscription = AppState.addEventListener('change', (nextState) => {
            if (nextState === 'active') {
                void runSync('app_active');
            }
        });
    },

    stop() {
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
        if (appStateSubscription) {
            appStateSubscription.remove();
            appStateSubscription = null;
        }
        console.log('[BackgroundSync] Stopped');
    },
};
