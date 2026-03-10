import React from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform, StatusBar,
} from 'react-native';
import { useAuthStore } from '../store/authStore';
import { useVaultStore } from '../store/vaultStore';
import { Colors, Spacing, Radius, Typography } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import { API_URL } from '../config';
import { SecureStorageService } from '../services/secureStorage';
import { LinearGradient } from 'expo-linear-gradient';
import { formatTimestampIST } from '../utils/formatIST';

function SettingRow({ icon, title, subtitle, onPress, danger = false }: {
    icon: string;
    title: string;
    subtitle?: string;
    onPress?: () => void;
    danger?: boolean;
}) {
    return (
        <TouchableOpacity style={styles.row} onPress={onPress} disabled={!onPress}>
            <View style={[styles.rowIcon, danger && styles.rowIconDanger]}>
                <Ionicons name={icon as any} size={20} color={danger ? Colors.destructive : Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, danger && { color: Colors.destructive }]}>{title}</Text>
                {subtitle && <Text style={styles.rowSub}>{subtitle}</Text>}
            </View>
            {onPress && <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />}
        </TouchableOpacity>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>{title}</Text>
            <View style={styles.sectionBody}>{children}</View>
        </View>
    );
}

export default function SettingsScreen() {
    const { logout, userId, fullName, email } = useAuthStore();
    const { entries, clearVault, isSyncing, pendingSyncCount, lastSyncTime } = useVaultStore();
    const navigation = useNavigation<any>();

    const activeCount = entries.filter((entry) => entry && entry.id && entry.url && !entry.isDeleted).length;
    const vaultStatusSubtitle = isSyncing
        ? 'Sync in progress...'
        : pendingSyncCount > 0
            ? `${activeCount} active items (${pendingSyncCount} pending sync)`
            : `${activeCount} active items • Last synced ${formatTimestampIST(lastSyncTime)}`;

    const confirmAction = (title: string, message: string): Promise<boolean> => {
        if (Platform.OS === 'web') {
            return Promise.resolve(window.confirm(`${title}\n\n${message}`));
        }
        return new Promise((resolve) => {
            Alert.alert(title, message, [
                { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                { text: 'Confirm', style: 'destructive', onPress: () => resolve(true) },
            ]);
        });
    };

    const handleLogout = () => {
        (async () => {
            const confirmed = await confirmAction(
                'Sign Out',
                'You will need to re-enter your master password to access your vault.',
            );
            if (!confirmed) return;
            try {
                clearVault();
                await logout();
            } catch (e) {
                console.error('[Auth] Sign out failed', e);
                Alert.alert('Sign out failed', 'Please try again.');
            }
        })();
    };

    const handleDeleteAccount = () => {
        (async () => {
            const confirmed = await confirmAction(
                'Delete Account',
                'This will permanently delete your account and all encrypted data. This cannot be undone.',
            );
            if (!confirmed) return;
            try {
                const token = await SecureStorageService.getSessionId();
                if (!token) throw new Error('Missing session token');

                await axios.delete(`${API_URL}/auth/account`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                clearVault();
                await logout();
                Alert.alert('Account Deleted', 'Your account has been deleted.');
            } catch (error: any) {
                const message = error?.response?.data?.message || error?.message || 'Failed to delete account';
                Alert.alert('Delete Failed', message);
            }
        })();
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <LinearGradient
                colors={[Colors.background, '#080808', '#121212']}
                style={styles.gradient}
            >
                <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
                    {/* Header */}
                    <View style={styles.header}>
                        <LinearGradient
                            colors={[Colors.primaryDim, 'transparent']}
                            style={styles.headerGradient}
                        />
                        <View style={styles.avatarContainer}>
                            <View style={styles.avatarRing}>
                                <Ionicons name="person" size={40} color={Colors.primary} />
                            </View>
                        </View>
                        <Text style={styles.headerTitle}>{fullName}</Text>
                        <Text style={styles.headerSub}>{email || 'No email provided'}</Text>
                    </View>

                    <Section title="Security & Privacy">
                        <SettingRow
                            icon="lock-closed-outline"
                            title="Change Master Password"
                            subtitle="Re-encrypt your entire vault"
                            onPress={() => navigation.navigate('ChangePassword')}
                        />
                        <SettingRow
                            icon="shield-checkmark-outline"
                            title="Emergency Kit"
                            subtitle="Generate a recovery key"
                            onPress={() => navigation.navigate('EmergencyKit')}
                        />
                    </Section>

                    <Section title="Data & Sync">
                        <SettingRow
                            icon="sync-outline"
                            title="Vault Status"
                            subtitle={vaultStatusSubtitle}
                        />
                    </Section>

                    <Section title="Account Actions">
                        <SettingRow
                            icon="log-out-outline"
                            title="Sign Out"
                            subtitle="Safe exit from your session"
                            onPress={handleLogout}
                            danger
                        />
                        <SettingRow
                            icon="trash-outline"
                            title="Delete Account"
                            subtitle="Permanently erase everything"
                            onPress={handleDeleteAccount}
                            danger
                        />
                    </Section>

                </ScrollView>
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    gradient: { flex: 1 },
    header: {
        alignItems: 'center',
        paddingTop: Platform.OS === 'ios' ? 80 : 60,
        paddingBottom: Spacing.xl,
        position: 'relative',
    },
    headerGradient: {
        position: 'absolute',
        top: 0, left: 0, right: 0, height: 200,
    },
    avatarContainer: {
        position: 'relative',
        marginBottom: 16,
    },
    avatarRing: {
        width: 100, height: 100, borderRadius: 50,
        backgroundColor: Colors.surface,
        borderWidth: 3, borderColor: Colors.primary,
        justifyContent: 'center', alignItems: 'center',
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
        elevation: 12,
    },
    editAvatarBtn: {
        position: 'absolute',
        bottom: 0, right: 0,
        backgroundColor: Colors.primary,
        width: 32, height: 32, borderRadius: 16,
        justifyContent: 'center', alignItems: 'center',
        borderWidth: 3, borderColor: Colors.background,
    },
    headerTitle: { ...Typography.heading, fontSize: 24 },
    headerSub: { ...Typography.muted, fontSize: 14, marginTop: 4 },
    userIdBadge: {
        marginTop: 12,
        backgroundColor: Colors.surfaceElevated,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: Radius.full,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    userIdText: { ...Typography.mono, fontSize: 10, color: Colors.textMuted },
    section: { marginTop: Spacing.xl, paddingHorizontal: Spacing.lg },
    sectionTitle: {
        ...Typography.muted, fontSize: 11, fontWeight: '700',
        textTransform: 'uppercase', letterSpacing: 1.5,
        marginBottom: 12, marginLeft: 4,
    },
    sectionBody: {
        backgroundColor: Colors.surface + '99',
        borderRadius: Radius.xl,
        borderWidth: 1, borderColor: Colors.border,
        overflow: 'hidden',
    },
    row: {
        flexDirection: 'row', alignItems: 'center',
        padding: Spacing.md, gap: 14,
        borderBottomWidth: 1, borderBottomColor: Colors.border + '33',
    },
    rowIcon: {
        width: 40, height: 40, borderRadius: Radius.md,
        backgroundColor: Colors.primaryDim,
        justifyContent: 'center', alignItems: 'center',
    },
    rowIconDanger: { backgroundColor: 'rgba(239, 68, 68, 0.1)' },
    rowTitle: { ...Typography.subheading, fontSize: 15 },
    rowSub: { ...Typography.muted, fontSize: 12, marginTop: 2 },
    footer: { alignItems: 'center', marginTop: 40, paddingBottom: 40 },
    badges: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    footerIcon: {
        width: 24, height: 24, borderRadius: 12,
        backgroundColor: Colors.primaryDim,
        justifyContent: 'center', alignItems: 'center',
    },
    footerText: { ...Typography.heading, fontSize: 14, color: Colors.textDim },
    copyright: { ...Typography.muted, fontSize: 11 },
});
