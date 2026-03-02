import React, { useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image
} from 'react-native';
import { useAuthStore } from '../store/authStore';
import { useVaultStore } from '../store/vaultStore';
import { Colors, Spacing, Radius, Typography } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { formatTimestampIST } from '../utils/formatIST';

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: string | number; color?: string }) {
    return (
        <View style={[styles.statCard, color ? { borderColor: color + '33' } : {}]}>
            <View style={[styles.statIcon, { backgroundColor: (color || Colors.primary) + '22' }]}>
                <Ionicons name={icon as any} size={20} color={color || Colors.primary} />
            </View>
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    );
}

export default function DashboardScreen() {
    const { masterKey, userId, fullName, logout } = useAuthStore() as any;
    const { entries, isLoading, isSyncing, lastSyncTime, loadVault } = useVaultStore();
    const navigation = useNavigation<any>();

    useEffect(() => {
        if (masterKey && userId) loadVault(masterKey, userId);
    }, [masterKey, userId]);

    const greeting = () => {
        const h = new Date().getHours();
        if (h < 12) return 'Good morning';
        if (h < 18) return 'Good afternoon';
        return 'Good evening';
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 80 }}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.glow} />
                <View style={styles.logoContainer}>
                    <Image 
                        source={require('../../assets/logo.png')} 
                        style={styles.logoImage}
                    />
                </View>
                <Text style={styles.greeting}>{greeting()}</Text>
                <Text style={styles.appName}>ZeroKnowledge <Text style={{ color: Colors.primary }}>Vault</Text></Text>
                <Text style={styles.subtext}>Your passwords, encrypted end-to-end</Text>
            </View>

            {/* Syncing indicator strip — non-blocking */}
            {isSyncing && (
                <View style={styles.syncBanner}>
                    <ActivityIndicator size="small" color={Colors.primary} style={{ marginRight: 6 }} />
                    <Text style={styles.syncBannerText}>Syncing vault…</Text>
                </View>
            )}

            {/* Stats */}
            <View style={styles.statsRow}>
                <StatCard icon="key" label="Credentials" value={isLoading ? '…' : entries.length} />
                <StatCard icon="shield-checkmark" label="Encryption" value="AES-256" color={Colors.success} />
                <StatCard
                    icon="sync"
                    label="Last Sync"
                    value={isSyncing ? 'Syncing…' : formatTimestampIST(lastSyncTime)}
                    color={Colors.purple}
                />
            </View>

            {/* Quick Actions */}
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.actionsGrid}>
                <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('Vault')}>
                    <View style={[styles.actionIcon, { backgroundColor: Colors.primaryDim }]}>
                        <Ionicons name="list" size={24} color={Colors.primary} />
                    </View>
                    <Text style={styles.actionTitle}>View Vault</Text>
                    <Text style={styles.actionSub}>Browse your passwords</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('AddCredential')}>
                    <View style={[styles.actionIcon, { backgroundColor: Colors.purpleDim }]}>
                        <Ionicons name="add-circle" size={24} color={Colors.purple} />
                    </View>
                    <Text style={styles.actionTitle}>Add Password</Text>
                    <Text style={styles.actionSub}>Encrypt & store new credential</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('Settings')}>
                    <View style={[styles.actionIcon, { backgroundColor: Colors.destructiveDim }]}>
                        <Ionicons name="settings" size={24} color={Colors.destructive} />
                    </View>
                    <Text style={styles.actionTitle}>Settings</Text>
                    <Text style={styles.actionSub}>Security & account</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    syncBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 6,
        backgroundColor: Colors.primaryDim,
        borderBottomWidth: 1,
        borderBottomColor: Colors.primaryBorder,
    },
    syncBannerText: {
        color: Colors.primary,
        fontSize: 12,
        fontWeight: '600',
    },
    header: {
        alignItems: 'center', paddingTop: 60, paddingBottom: Spacing.xl,
        paddingHorizontal: Spacing.md, overflow: 'hidden', position: 'relative',
        borderBottomWidth: 1, borderBottomColor: Colors.border,
    },
    glow: {
        position: 'absolute', top: -40, width: 200, height: 200, borderRadius: 100,
        backgroundColor: Colors.primary, opacity: 0.06,
    },
    logoContainer: {
        width: 72, height: 72,
        justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.sm,
    },
    logoImage: {
        width: 60, height: 60, borderRadius: Radius.md,
    },
    greeting: { ...Typography.muted, fontSize: 13, marginBottom: 4 },
    appName: { ...Typography.heading, fontSize: 26, marginBottom: 4 },
    subtext: { ...Typography.muted, fontSize: 13 },
    statsRow: { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.md, paddingBottom: 0 },
    statCard: {
        flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.lg,
        borderWidth: 1, borderColor: Colors.border, alignItems: 'center', padding: Spacing.md, gap: 4,
    },
    statIcon: {
        width: 36, height: 36, borderRadius: Radius.sm,
        justifyContent: 'center', alignItems: 'center', marginBottom: 4,
    },
    statValue: { ...Typography.heading, fontSize: 18 },
    statLabel: { ...Typography.muted, fontSize: 11, textAlign: 'center' },
    sectionTitle: {
        ...Typography.muted, fontSize: 11, fontWeight: '700',
        textTransform: 'uppercase', letterSpacing: 1,
        paddingHorizontal: Spacing.md, marginTop: Spacing.lg, marginBottom: Spacing.sm,
    },
    actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: Spacing.sm, gap: Spacing.sm },
    actionCard: {
        flex: 1, minWidth: '44%', backgroundColor: Colors.surface,
        borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border,
        padding: Spacing.md, gap: 6,
    },
    actionIcon: {
        width: 44, height: 44, borderRadius: Radius.md,
        justifyContent: 'center', alignItems: 'center', marginBottom: 4,
    },
    actionTitle: { ...Typography.subheading, fontSize: 14 },
    actionSub: { ...Typography.muted, fontSize: 12 },
    securityCard: {
        margin: Spacing.md,
        backgroundColor: Colors.primaryDim, borderRadius: Radius.lg,
        borderWidth: 1, borderColor: Colors.primaryBorder, padding: Spacing.md,
    },
    securityTitle: { ...Typography.subheading, fontSize: 14, marginBottom: 6 },
    securityText: { ...Typography.muted, fontSize: 13, lineHeight: 20, marginBottom: Spacing.sm },
    securityBadges: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap' },
    securityBadge: {
        backgroundColor: Colors.primary + '22', borderRadius: Radius.full,
        paddingHorizontal: 10, paddingVertical: 4,
        borderWidth: 1, borderColor: Colors.primaryBorder,
    },
    securityBadgeText: { color: Colors.primary, fontSize: 11, fontWeight: '600' },
});
