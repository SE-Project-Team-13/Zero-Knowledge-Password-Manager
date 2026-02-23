import React from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
} from 'react-native';
import { useAuthStore } from '../store/authStore';
import { useVaultStore } from '../store/vaultStore';
import { Colors, Spacing, Radius, Typography } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import { API_URL } from '../config';
import { SecureStorageService } from '../services/secureStorage';

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
    const { logout, userId } = useAuthStore();
    const { entries, clearVault } = useVaultStore();
    const navigation = useNavigation<any>();

    const handleLogout = () => {
        Alert.alert('Sign Out', 'You will need to re-enter your master password to access your vault.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Sign Out',
                style: 'destructive',
                onPress: async () => {
                    try {
                        clearVault();
                        await logout();
                        navigation.reset({
                            index: 0,
                            routes: [{ name: 'Login' }],
                        });
                        console.log('[Auth] Sign out completed');
                    } catch (e) {
                        console.error('[Auth] Sign out failed', e);
                        Alert.alert('Sign out failed', 'Please try again.');
                    }
                },
            },
        ]);
    };

    const handleDeleteAccount = () => {
        Alert.alert(
            'Delete Account',
            'This will permanently delete your account and all encrypted data. This cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const token = await SecureStorageService.getSessionId();
                            if (!token) throw new Error('Missing session token');

                            await axios.delete(`${API_URL}/auth/account`, {
                                headers: {
                                    Authorization: `Bearer ${token}`,
                                },
                            });

                            clearVault();
                            await logout();
                            Alert.alert('Account Deleted', 'Your account has been deleted.');
                        } catch (error: any) {
                            const message = error?.response?.data?.message || error?.message || 'Failed to delete account';
                            Alert.alert('Delete Failed', message);
                        }
                    },
                },
            ],
        );
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 80 }}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.avatarRing}>
                    <Ionicons name="person" size={32} color={Colors.primary} />
                </View>
                <Text style={styles.headerTitle}>Settings</Text>
                <Text style={styles.headerSub}>User ID: {userId?.slice(0, 8)}...</Text>
            </View>

            <Section title="Security">
                <SettingRow
                    icon="lock-closed-outline"
                    title="Change Master Password"
                    subtitle="Re-encrypt your vault with a new password"
                    onPress={() => navigation.navigate('ChangePassword')}
                />
                <SettingRow
                    icon="shield-checkmark-outline"
                    title="Encryption"
                    subtitle="AES-256-GCM + Argon2id KDF"
                />
                <SettingRow
                    icon="key-outline"
                    title="Zero-Knowledge"
                    subtitle="Your master password never leaves this device"
                />
                <SettingRow
                    icon="sync-outline"
                    title="Vault Items"
                    subtitle={`${entries.length} encrypted credential${entries.length !== 1 ? 's' : ''} synced`}
                />
            </Section>

            <Section title="Danger Zone">
                <SettingRow
                    icon="trash-outline"
                    title="Delete Account"
                    subtitle="Permanently remove your account and vault data"
                    onPress={handleDeleteAccount}
                    danger
                />
                <SettingRow
                    icon="log-out-outline"
                    title="Sign Out"
                    subtitle="Clears session and vault cache"
                    onPress={handleLogout}
                    danger
                />
            </Section>

            <View style={styles.footer}>
                <View style={styles.badges}>
                    <View style={styles.badge}>
                        <Ionicons name="shield-checkmark" size={12} color={Colors.success} />
                        <Text style={styles.badgeText}>AES-256-GCM</Text>
                    </View>
                    <View style={styles.badge}>
                        <Ionicons name="lock-closed" size={12} color={Colors.primary} />
                        <Text style={styles.badgeText}>Argon2id</Text>
                    </View>
                    <View style={styles.badge}>
                        <Ionicons name="key" size={12} color={Colors.purple} />
                        <Text style={styles.badgeText}>Zero-Knowledge</Text>
                    </View>
                </View>
                <Text style={styles.footerText}>© 2026 ZeroKnowledge Password Manager</Text>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: {
        alignItems: 'center', paddingTop: 60, paddingBottom: Spacing.xl,
        paddingHorizontal: Spacing.md,
        borderBottomWidth: 1, borderBottomColor: Colors.border,
    },
    avatarRing: {
        width: 72, height: 72, borderRadius: 36,
        backgroundColor: Colors.primaryDim,
        borderWidth: 2, borderColor: Colors.primaryBorder,
        justifyContent: 'center', alignItems: 'center',
        marginBottom: Spacing.sm,
    },
    headerTitle: { ...Typography.heading, fontSize: 22 },
    headerSub: { ...Typography.muted, fontSize: 12, marginTop: 4 },
    section: { marginTop: Spacing.lg, paddingHorizontal: Spacing.md },
    sectionTitle: {
        ...Typography.muted, fontSize: 11, fontWeight: '700',
        textTransform: 'uppercase', letterSpacing: 1,
        marginBottom: Spacing.sm,
    },
    sectionBody: {
        backgroundColor: Colors.surface,
        borderRadius: Radius.lg,
        borderWidth: 1, borderColor: Colors.border,
        overflow: 'hidden',
    },
    row: {
        flexDirection: 'row', alignItems: 'center',
        padding: Spacing.md, gap: Spacing.sm,
        borderBottomWidth: 1, borderBottomColor: Colors.border,
    },
    rowIcon: {
        width: 36, height: 36, borderRadius: Radius.sm,
        backgroundColor: Colors.primaryDim,
        justifyContent: 'center', alignItems: 'center',
    },
    rowIconDanger: { backgroundColor: Colors.destructiveDim },
    rowTitle: { ...Typography.body, fontSize: 15 },
    rowSub: { ...Typography.muted, fontSize: 12, marginTop: 2 },
    footer: { alignItems: 'center', marginTop: Spacing.xxl, paddingHorizontal: Spacing.md },
    badges: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
    badge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: Colors.surface, borderRadius: Radius.full,
        paddingHorizontal: 10, paddingVertical: 5,
        borderWidth: 1, borderColor: Colors.border,
    },
    badgeText: { ...Typography.muted, fontSize: 11 },
    footerText: { ...Typography.muted, fontSize: 12 },
});
