import { AppState } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { useVaultStore } from '../store/vaultStore';

const BACKGROUND_SYNC_INTERVAL_MS = 3 * 60 * 1000; // every 3 minutes

let timer: ReturnType<typeof setInterval> | null = null;
let appStateSubscription: { remove: () => void } | null = null;
let isSyncRunning = false;

async function runSync(reason: 'interval' | 'app_active') {
    if (isSyncRunning) return;

    const { isAuthenticated, userId, masterKey } = useAuthStore.getState();
    if (!isAuthenticated || !userId || !masterKey) return;

    isSyncRunning = true;
    try {
        console.log('[BackgroundSync] Running sync', { reason, userId });
        await useVaultStore.getState().loadVault(masterKey, userId);
        console.log('[BackgroundSync] Sync complete', { reason });
    } catch (error) {
        console.error('[BackgroundSync] Sync failed', error);
    } finally {
        isSyncRunning = false;
    }
}

export const BackgroundSyncService = {
    start() {
        if (timer) return;

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

