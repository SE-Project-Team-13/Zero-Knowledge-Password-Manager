import React, { useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    TextInput, ActivityIndicator, RefreshControl, Alert,
    Clipboard, Animated,
} from 'react-native';
import { useAuthStore } from '../store/authStore';
import { useVaultStore, VaultEntry } from '../store/vaultStore';
import { Colors, Spacing, Radius, Typography } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

function PasswordDots() {
    return <Text style={{ color: Colors.textMuted, letterSpacing: 2, fontSize: 18 }}>{'●'.repeat(8)}</Text>;
}

function VaultCard({ entry, onDelete }: { entry: VaultEntry; onDelete: (id: string) => void }) {
    const [revealed, setRevealed] = useState(false);
    const [copied, setCopied] = useState<'user' | 'pass' | null>(null);

    const copyToClipboard = (text: string, type: 'user' | 'pass') => {
        Clipboard.setString(text);
        setCopied(type);
        setTimeout(() => setCopied(null), 2000);
        // Auto-clear clipboard after 30 seconds for security
        setTimeout(() => Clipboard.setString(''), 30000);
    };

    const confirmDelete = () => {
        Alert.alert('Delete Credential', `Remove "${entry.site}"?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => onDelete(entry.id) },
        ]);
    };

    const initials = entry.site?.charAt(0).toUpperCase() || '?';

    return (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View style={styles.siteAvatar}>
                    <Text style={styles.siteInitial}>{initials}</Text>
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.siteName}>{entry.site}</Text>
                    <Text style={styles.siteUsername}>{entry.username}</Text>
                </View>
                <TouchableOpacity onPress={confirmDelete} style={styles.deleteBtn}>
                    <Ionicons name="trash-outline" size={18} color={Colors.destructive} />
                </TouchableOpacity>
            </View>

            <View style={styles.cardActions}>
                {/* Copy username */}
                <TouchableOpacity style={styles.copyBtn} onPress={() => copyToClipboard(entry.username, 'user')}>
                    <Ionicons name={copied === 'user' ? 'checkmark' : 'person-outline'} size={14} color={Colors.primary} />
                    <Text style={styles.copyBtnText}>{copied === 'user' ? 'Copied!' : 'Username'}</Text>
                </TouchableOpacity>

                {/* Reveal / Copy password */}
                <TouchableOpacity style={styles.copyBtn} onPress={() => setRevealed(r => !r)}>
                    <Ionicons name={revealed ? 'eye-off-outline' : 'eye-outline'} size={14} color={Colors.primary} />
                    <Text style={styles.copyBtnText}>{revealed ? 'Hide' : 'Reveal'}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.copyBtn} onPress={() => copyToClipboard(entry.password, 'pass')}>
                    <Ionicons name={copied === 'pass' ? 'checkmark' : 'copy-outline'} size={14} color={Colors.primary} />
                    <Text style={styles.copyBtnText}>{copied === 'pass' ? 'Copied!' : 'Password'}</Text>
                </TouchableOpacity>
            </View>

            {revealed && (
                <View style={styles.revealedPw}>
                    <Text style={styles.revealedPwText}>{entry.password}</Text>
                </View>
            )}
        </View>
    );
}

export default function VaultListScreen() {
    const { masterKey, userId } = useAuthStore();
    const { entries, isLoading, isSyncing, loadVault, deleteEntry } = useVaultStore();
    const [search, setSearch] = useState('');
    const navigation = useNavigation<any>();

    useEffect(() => {
        if (masterKey && userId) {
            loadVault(masterKey, userId);
        }
    }, [masterKey, userId]);

    const filtered = entries.filter(e =>
        e.site.toLowerCase().includes(search.toLowerCase()) ||
        e.username.toLowerCase().includes(search.toLowerCase())
    );

    const handleDelete = async (id: string) => {
        if (masterKey && userId) await deleteEntry(id, masterKey, userId);
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>Vault</Text>
                    <Text style={styles.headerSub}>{entries.length} credential{entries.length !== 1 ? 's' : ''}</Text>
                </View>
                {isSyncing && <ActivityIndicator size="small" color={Colors.primary} />}
            </View>

            {/* Search */}
            <View style={styles.searchRow}>
                <Ionicons name="search" size={16} color={Colors.textMuted} style={{ marginRight: 8 }} />
                <TextInput
                    style={styles.searchInput}
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search site or username..."
                    placeholderTextColor={Colors.textMuted}
                />
                {search.length > 0 && (
                    <TouchableOpacity onPress={() => setSearch('')}>
                        <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
                    </TouchableOpacity>
                )}
            </View>

            {isLoading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                    <Text style={[Typography.muted, { marginTop: 12 }]}>Decrypting vault...</Text>
                </View>
            ) : filtered.length === 0 ? (
                <View style={styles.centered}>
                    <Ionicons name="lock-closed-outline" size={48} color={Colors.textDim} />
                    <Text style={styles.emptyTitle}>{search ? 'No results' : 'Vault is empty'}</Text>
                    <Text style={styles.emptyText}>
                        {search ? 'Try a different search' : 'Tap + to add your first credential'}
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={filtered}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => <VaultCard entry={item} onDelete={handleDelete} />}
                    contentContainerStyle={{ padding: Spacing.md, paddingBottom: 100 }}
                    refreshControl={
                        <RefreshControl
                            refreshing={isLoading}
                            onRefresh={() => masterKey && userId && loadVault(masterKey, userId)}
                            tintColor={Colors.primary}
                        />
                    }
                />
            )}

            {/* FAB */}
            <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('AddCredential')}>
                <Ionicons name="add" size={28} color={Colors.background} />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: Spacing.md, paddingTop: 60, paddingBottom: Spacing.md,
        borderBottomWidth: 1, borderBottomColor: Colors.border,
    },
    headerTitle: { ...Typography.heading, fontSize: 28 },
    headerSub: { ...Typography.muted, fontSize: 13, marginTop: 2 },
    searchRow: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: Colors.surface,
        margin: Spacing.md,
        paddingHorizontal: Spacing.md,
        paddingVertical: 10,
        borderRadius: Radius.md,
        borderWidth: 1, borderColor: Colors.border,
    },
    searchInput: { flex: 1, ...Typography.body, fontSize: 15, padding: 0 },
    card: {
        backgroundColor: Colors.surface,
        borderRadius: Radius.lg,
        borderWidth: 1, borderColor: Colors.border,
        marginBottom: Spacing.sm,
        overflow: 'hidden',
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md },
    siteAvatar: {
        width: 40, height: 40, borderRadius: Radius.md,
        backgroundColor: Colors.primaryDim,
        borderWidth: 1, borderColor: Colors.primaryBorder,
        justifyContent: 'center', alignItems: 'center',
        marginRight: Spacing.sm,
    },
    siteInitial: { color: Colors.primary, fontSize: 18, fontWeight: '700' },
    siteName: { ...Typography.subheading, fontSize: 15 },
    siteUsername: { ...Typography.muted, fontSize: 12, marginTop: 2 },
    deleteBtn: { padding: 6 },
    cardActions: {
        flexDirection: 'row',
        borderTopWidth: 1, borderTopColor: Colors.border,
        paddingHorizontal: Spacing.sm, paddingVertical: 6,
        gap: 4,
    },
    copyBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 4, paddingVertical: 6, borderRadius: Radius.sm,
        backgroundColor: Colors.primaryDim,
    },
    copyBtnText: { color: Colors.primary, fontSize: 12, fontWeight: '600' },
    revealedPw: {
        backgroundColor: Colors.surfaceElevated,
        padding: Spacing.sm, paddingHorizontal: Spacing.md,
        borderTopWidth: 1, borderTopColor: Colors.border,
    },
    revealedPwText: { ...Typography.mono, fontSize: 14, letterSpacing: 1 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8, padding: Spacing.xl },
    emptyTitle: { ...Typography.subheading, fontSize: 18, marginTop: Spacing.sm },
    emptyText: { ...Typography.muted, textAlign: 'center' },
    fab: {
        position: 'absolute', bottom: 28, right: 24,
        width: 56, height: 56, borderRadius: 28,
        backgroundColor: Colors.primary,
        justifyContent: 'center', alignItems: 'center',
        shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5, shadowRadius: 12, elevation: 8,
    },
});
