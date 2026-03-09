import React, { useEffect, useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image, StatusBar, Platform, Alert
} from 'react-native';
import { useAuthStore } from '../store/authStore';
import { useVaultStore } from '../store/vaultStore';
import { Colors, Spacing, Radius, Typography } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { formatTimestampIST } from '../utils/formatIST';
import { LinearGradient } from 'expo-linear-gradient';

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: string | number; color?: string }) {
    return (
        <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: (color || Colors.primary) + '15' }]}>
                <Ionicons name={icon as any} size={20} color={color || Colors.primary} />
            </View>
            <View>
                <Text style={styles.statValue}>{value}</Text>
                <Text style={styles.statLabel}>{label}</Text>
            </View>
        </View>
    );
}

export default function DashboardScreen() {
    const { masterKey, userId, fullName } = useAuthStore() as any;
    const { entries, isLoading, isSyncing, lastSyncTime, loadVault } = useVaultStore();
    const navigation = useNavigation<any>();
    const [isManualSyncing, setIsManualSyncing] = useState(false);

    const activeCredentialCount = useMemo(
        () => entries.filter((entry) => entry && entry.id && entry.url).length,
        [entries],
    );

    useEffect(() => {
        if (masterKey && userId) loadVault(masterKey, userId);
    }, [masterKey, userId]);

    const handleManualSync = async () => {
        if (!masterKey || !userId) {
            Alert.alert('Sync unavailable', 'Please sign in again to sync.');
            return;
        }
        setIsManualSyncing(true);
        try {
            await loadVault(masterKey, userId);
            Alert.alert('Sync complete', 'Vault has been refreshed from server.');
        } catch (e: any) {
            Alert.alert('Sync failed', e?.message || 'Unable to sync right now.');
        } finally {
            setIsManualSyncing(false);
        }
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
                        <View style={styles.headerRow}>
                            <View>
                                <Text style={styles.greeting}>Welcome back,</Text>
                                <Text style={styles.userName}>{fullName || 'User'}</Text>
                            </View>
                            <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={styles.profileBtn}>
                                <Ionicons name="person-circle-outline" size={40} color={Colors.primary} />
                            </TouchableOpacity>
                        </View>
                        
                        {/* Summary Card */}
                        <LinearGradient
                            colors={[Colors.surfaceElevated, Colors.surface]}
                            style={styles.summaryCard}
                        >
                            <View style={styles.summaryHeader}>
                                <View style={styles.iconCircle}>
                                    <Ionicons name="shield-checkmark" size={24} color={Colors.primary} />
                                </View>
                                <View>
                                    <Text style={styles.summaryTitle}>Zenith <Text style={{ color: Colors.primary }}>Vault</Text></Text>
                                    <Text style={styles.summarySubtitle}>Security overview</Text>
                                </View>
                            </View>
                            
                            <View style={styles.statsRow}>
                                <StatCard icon="key" label="Stored Passwords" value={isLoading ? '...' : activeCredentialCount} />
                                <StatCard icon="sync" label="Last Sync" value={formatTimestampIST(lastSyncTime).split(',')[0]} color={Colors.success} />
                            </View>
                            
                            {(isSyncing || isManualSyncing) && (
                                <View style={styles.syncingRow}>
                                    <ActivityIndicator size="small" color={Colors.primary} />
                                    <Text style={styles.syncingText}>Syncing securely...</Text>
                                </View>
                            )}
                            <TouchableOpacity
                                style={styles.manualSyncBtn}
                                onPress={handleManualSync}
                                disabled={isSyncing || isManualSyncing}
                            >
                                <Ionicons name="sync-outline" size={14} color={Colors.primary} />
                                <Text style={styles.manualSyncBtnText}>{isManualSyncing ? 'Syncing...' : 'Manual Sync'}</Text>
                            </TouchableOpacity>
                        </LinearGradient>
                    </View>

                    {/* Quick Actions */}
                    <View style={styles.sectionContainer}>
                        <Text style={styles.sectionTitle}>Quick Actions</Text>
                        <View style={styles.actionsGrid}>
                            <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('Vault')}>
                                <LinearGradient colors={['rgba(255,193,7,0.1)', 'rgba(255,193,7,0.02)']} style={styles.actionGradient}>
                                    <View style={styles.actionIconContainer}>
                                        <Ionicons name="list" size={26} color={Colors.primary} />
                                    </View>
                                    <Text style={styles.actionTitle}>View Vault</Text>
                                    <Text style={styles.actionSub}>Browse passwords</Text>
                                    <Ionicons name="chevron-forward" size={16} color={Colors.textDim} style={styles.actionArrow} />
                                </LinearGradient>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('AddCredential')}>
                                <LinearGradient colors={['rgba(111,66,193,0.1)', 'rgba(111,66,193,0.02)']} style={styles.actionGradient}>
                                    <View style={styles.actionIconContainer}>
                                        <Ionicons name="add-circle" size={26} color={Colors.purple} />
                                    </View>
                                    <Text style={styles.actionTitle}>Add Entry</Text>
                                    <Text style={styles.actionSub}>Encrypt & store</Text>
                                    <Ionicons name="chevron-forward" size={16} color={Colors.textDim} style={styles.actionArrow} />
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Security Info */}
                    <View style={styles.sectionContainer}>
                        <Text style={styles.sectionTitle}>Vault Security</Text>
                        <View style={styles.securityCard}>
                            <View style={styles.securityItem}>
                                <Ionicons name="lock-closed" size={18} color={Colors.success} />
                                <Text style={styles.securityText}>AES-256-GCM Encryption</Text>
                            </View>
                            <View style={styles.securityItem}>
                                <Ionicons name="key" size={18} color={Colors.primary} />
                                <Text style={styles.securityText}>Zero-Knowledge Protocol</Text>
                            </View>
                            <View style={styles.securityItem}>
                                <Ionicons name="finger-print" size={18} color={Colors.purple} />
                                <Text style={styles.securityText}>Local Biometric Ready</Text>
                            </View>
                        </View>
                    </View>
                </ScrollView>
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    gradient: { flex: 1 },
    header: {
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingHorizontal: Spacing.lg,
        paddingBottom: Spacing.xl,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    greeting: { ...Typography.muted, fontSize: 13 },
    userName: { ...Typography.heading, fontSize: 24 },
    profileBtn: { padding: 4 },
    summaryCard: {
        borderRadius: Radius.xl,
        padding: Spacing.lg,
        borderWidth: 1,
        borderColor: Colors.border,
        gap: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    summaryHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    iconCircle: {
        width: 48, height: 48, borderRadius: Radius.md,
        backgroundColor: Colors.primaryDim,
        justifyContent: 'center', alignItems: 'center',
        borderWidth: 1, borderColor: Colors.primaryBorder,
    },
    summaryTitle: { ...Typography.heading, fontSize: 20 },
    summarySubtitle: { ...Typography.muted, fontSize: 12 },
    statsRow: {
        flexDirection: 'row',
        gap: Spacing.md,
    },
    statCard: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    statIcon: {
        width: 36, height: 36, borderRadius: Radius.sm,
        justifyContent: 'center', alignItems: 'center',
    },
    statValue: { ...Typography.heading, fontSize: 16 },
    statLabel: { ...Typography.muted, fontSize: 10 },
    syncingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
    },
    syncingText: { fontSize: 11, color: Colors.primary, fontWeight: '600' },
    manualSyncBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 8,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.primaryBorder,
        backgroundColor: Colors.primaryDim,
    },
    manualSyncBtnText: {
        color: Colors.primary,
        fontSize: 12,
        fontWeight: '700',
    },
    sectionContainer: {
        paddingHorizontal: Spacing.lg,
        marginBottom: Spacing.xl,
    },
    sectionTitle: {
        ...Typography.muted, fontSize: 11, fontWeight: '700',
        textTransform: 'uppercase', letterSpacing: 1.5,
        marginBottom: 16,
    },
    actionsGrid: {
        flexDirection: 'row',
        gap: Spacing.md,
    },
    actionCard: {
        flex: 1,
        borderRadius: Radius.lg,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: Colors.border,
    },
    actionGradient: {
        padding: Spacing.md,
        gap: 6,
        height: 140,
    },
    actionIconContainer: {
        width: 44, height: 44, borderRadius: Radius.md,
        backgroundColor: Colors.background,
        justifyContent: 'center', alignItems: 'center',
        marginBottom: 8,
        borderWidth: 1, borderColor: Colors.border,
    },
    actionTitle: { ...Typography.subheading, fontSize: 15 },
    actionSub: { ...Typography.muted, fontSize: 12 },
    actionArrow: {
        position: 'absolute',
        bottom: 12,
        right: 12,
    },
    securityCard: {
        backgroundColor: Colors.surface + '88',
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Colors.border,
        padding: Spacing.md,
        gap: 12,
    },
    securityItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    securityText: {
        ...Typography.body,
        fontSize: 13,
        color: Colors.textMuted,
    },
});
