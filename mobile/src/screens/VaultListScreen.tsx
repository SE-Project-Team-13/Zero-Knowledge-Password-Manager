import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    RefreshControl,
    Alert,
    Clipboard,
    Modal,
} from 'react-native';
import { useAuthStore } from '../store/authStore';
import { useVaultStore, type VaultEntryLocal } from '../store/vaultStore';
import { Colors, Spacing, Radius, Typography } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

function VaultCard({
    entry,
    onDelete,
    onEdit,
}: {
    entry: VaultEntryLocal;
    onDelete: (id: string) => void;
    onEdit: (entry: VaultEntryLocal) => void;
}) {
    const [revealed, setRevealed] = useState(false);
    const [copied, setCopied] = useState<'user' | 'pass' | null>(null);

    const copyToClipboard = (text: string, type: 'user' | 'pass') => {
        Clipboard.setString(text);
        setCopied(type);
        setTimeout(() => setCopied(null), 2000);
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
                    {!!entry.siteUrl && <Text style={styles.siteUrl}>{entry.siteUrl}</Text>}
                </View>
                <TouchableOpacity onPress={() => onEdit(entry)} style={styles.iconBtn}>
                    <Ionicons name="create-outline" size={18} color={Colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={confirmDelete} style={styles.iconBtn}>
                    <Ionicons name="trash-outline" size={18} color={Colors.destructive} />
                </TouchableOpacity>
            </View>

            <View style={styles.cardActions}>
                <TouchableOpacity style={styles.copyBtn} onPress={() => copyToClipboard(entry.username, 'user')}>
                    <Ionicons name={copied === 'user' ? 'checkmark' : 'person-outline'} size={14} color={Colors.primary} />
                    <Text style={styles.copyBtnText}>{copied === 'user' ? 'Copied!' : 'Username'}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.copyBtn} onPress={() => setRevealed((r) => !r)}>
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
                    {!!entry.notes && <Text style={styles.notesText}>{entry.notes}</Text>}
                </View>
            )}
        </View>
    );
}

export default function VaultListScreen() {
    const { masterKey, userId } = useAuthStore();
    const { entries, isLoading, isSyncing, loadVault, deleteEntry, updateEntry, syncConflict, resolveSyncConflict } = useVaultStore();
    const [search, setSearch] = useState('');
    const [editingEntry, setEditingEntry] = useState<VaultEntryLocal | null>(null);
    const [editSite, setEditSite] = useState('');
    const [editUsername, setEditUsername] = useState('');
    const [editPassword, setEditPassword] = useState('');
    const [editUrl, setEditUrl] = useState('');
    const [editNotes, setEditNotes] = useState('');
    const [showEditPassword, setShowEditPassword] = useState(false);
    const [isManualSyncing, setIsManualSyncing] = useState(false);
    const [isResolvingConflict, setIsResolvingConflict] = useState(false);
    const navigation = useNavigation<any>();

    useEffect(() => {
        if (masterKey && userId) {
            loadVault(masterKey, userId);
        }
    }, [masterKey, userId]);

    const filtered = entries.filter((e) =>
        e.site.toLowerCase().includes(search.toLowerCase()) ||
        e.username.toLowerCase().includes(search.toLowerCase()),
    );

    const handleDelete = async (id: string) => {
        if (masterKey && userId) await deleteEntry(id, masterKey, userId);
    };

    const openEdit = (entry: VaultEntryLocal) => {
        setEditingEntry(entry);
        setEditSite(entry.site || '');
        setEditUsername(entry.username || '');
        setEditPassword(entry.password || '');
        setEditUrl(entry.siteUrl || '');
        setEditNotes(entry.notes || '');
    };

    const saveEdit = async () => {
        if (!editingEntry || !masterKey || !userId) return;
        if (!editSite.trim() || !editUsername.trim() || !editPassword.trim()) {
            Alert.alert('Invalid Input', 'Site, username, and password are required.');
            return;
        }

        await updateEntry(
            {
                ...editingEntry,
                site: editSite.trim(),
                username: editUsername.trim(),
                password: editPassword,
                siteUrl: editUrl.trim(),
                notes: editNotes.trim(),
            },
            masterKey,
            userId,
        );

        setEditingEntry(null);
    };

    const handleManualSync = async () => {
        if (!masterKey || !userId) {
            console.warn('[Sync] Manual sync blocked: missing auth context');
            Alert.alert('Sync unavailable', 'Please sign in again to sync.');
            return;
        }
        setIsManualSyncing(true);
        try {
            console.log('[Sync] Manual sync started');
            await loadVault(masterKey, userId);
            console.log('[Sync] Manual sync finished');
            Alert.alert('Sync complete', 'Vault has been refreshed from server.');
        } catch (e: any) {
            console.error('[Sync] Manual sync failed', e?.message || e);
            Alert.alert('Sync failed', e?.message || 'Unable to sync right now.');
        } finally {
            setIsManualSyncing(false);
        }
    };

    const handleResolveConflict = async (choice: 'local' | 'server') => {
        if (!masterKey || !userId) return;
        setIsResolvingConflict(true);
        try {
            const ok = await resolveSyncConflict(choice, masterKey, userId);
            if (ok) {
                Alert.alert('Conflict Resolved', choice === 'local' ? 'Kept your local version.' : 'Kept server version.');
            } else {
                Alert.alert('Resolve Failed', 'Could not resolve conflict. Try again.');
            }
        } finally {
            setIsResolvingConflict(false);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>Vault</Text>
                    <Text style={styles.headerSub}>{entries.length} credential{entries.length !== 1 ? 's' : ''}</Text>
                </View>
                <View style={styles.headerActions}>
                    {(isSyncing || isManualSyncing) && <ActivityIndicator size="small" color={Colors.primary} />}
                    <TouchableOpacity style={styles.syncBtn} onPress={handleManualSync} disabled={isManualSyncing || isLoading || isSyncing}>
                        <Ionicons name="sync-outline" size={16} color={Colors.primary} />
                        <Text style={styles.syncBtnText}>{isManualSyncing ? 'Syncing...' : 'Sync'}</Text>
                    </TouchableOpacity>
                </View>
            </View>

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
                    renderItem={({ item }) => <VaultCard entry={item} onDelete={handleDelete} onEdit={openEdit} />}
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

            <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('AddCredential')}>
                <Ionicons name="add" size={28} color={Colors.background} />
            </TouchableOpacity>

            <Modal visible={!!editingEntry} transparent animationType="fade" onRequestClose={() => setEditingEntry(null)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Edit Credential</Text>

                        <TextInput style={styles.modalInput} value={editSite} onChangeText={setEditSite} placeholder="Site" placeholderTextColor={Colors.textMuted} />
                        <TextInput style={styles.modalInput} value={editUsername} onChangeText={setEditUsername} placeholder="Username" placeholderTextColor={Colors.textMuted} />

                        <View style={styles.modalInputRow}>
                            <TextInput
                                style={[styles.modalInput, { flex: 1, marginBottom: 0 }]}
                                value={editPassword}
                                onChangeText={setEditPassword}
                                placeholder="Password"
                                placeholderTextColor={Colors.textMuted}
                                secureTextEntry={!showEditPassword}
                            />
                            <TouchableOpacity onPress={() => setShowEditPassword((v) => !v)} style={styles.eyeBtn}>
                                <Ionicons name={showEditPassword ? 'eye-off-outline' : 'eye-outline'} size={16} color={Colors.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <TextInput style={styles.modalInput} value={editUrl} onChangeText={setEditUrl} placeholder="URL (optional)" placeholderTextColor={Colors.textMuted} />
                        <TextInput
                            style={[styles.modalInput, { height: 84, textAlignVertical: 'top' }]}
                            value={editNotes}
                            onChangeText={setEditNotes}
                            placeholder="Notes (optional)"
                            placeholderTextColor={Colors.textMuted}
                            multiline
                        />

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.modalBtnSecondary} onPress={() => setEditingEntry(null)}>
                                <Text style={styles.modalBtnSecondaryText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalBtnPrimary} onPress={saveEdit}>
                                <Text style={styles.modalBtnPrimaryText}>Save</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal visible={!!syncConflict} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Sync Conflict Detected</Text>
                        <Text style={styles.conflictText}>You changed data on two devices. Choose which version to keep.</Text>

                        <View style={styles.conflictColumns}>
                            <View style={styles.conflictCol}>
                                <Text style={styles.conflictHeading}>Local ({syncConflict?.localEntries.length || 0})</Text>
                                {(syncConflict?.localEntries || []).slice(0, 6).map((entry) => (
                                    <View key={`local-${entry.id}`} style={styles.conflictItem}>
                                        <Text style={styles.siteName}>{entry.site}</Text>
                                        <Text style={styles.siteUsername}>{entry.username}</Text>
                                    </View>
                                ))}
                            </View>
                            <View style={styles.conflictCol}>
                                <Text style={styles.conflictHeading}>Server ({syncConflict?.serverEntries.length || 0})</Text>
                                {(syncConflict?.serverEntries || []).slice(0, 6).map((entry) => (
                                    <View key={`server-${entry.id}`} style={styles.conflictItem}>
                                        <Text style={styles.siteName}>{entry.site}</Text>
                                        <Text style={styles.siteUsername}>{entry.username}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.modalBtnSecondary}
                                disabled={isResolvingConflict}
                                onPress={() => handleResolveConflict('server')}
                            >
                                <Text style={styles.modalBtnSecondaryText}>Keep Server</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.modalBtnPrimary}
                                disabled={isResolvingConflict}
                                onPress={() => handleResolveConflict('local')}
                            >
                                <Text style={styles.modalBtnPrimaryText}>{isResolvingConflict ? 'Resolving...' : 'Keep Mine'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
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
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    syncBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: Colors.primaryDim,
        borderWidth: 1,
        borderColor: Colors.primaryBorder,
        borderRadius: Radius.sm,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    syncBtnText: { color: Colors.primary, fontSize: 12, fontWeight: '700' },
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
    siteUrl: { ...Typography.muted, fontSize: 11, marginTop: 2 },
    iconBtn: { padding: 6 },
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
    notesText: { ...Typography.muted, fontSize: 12, marginTop: 8 },
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
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.55)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: Spacing.md,
    },
    modalCard: {
        width: '100%',
        backgroundColor: Colors.surface,
        borderRadius: Radius.lg,
        borderWidth: 1,
        borderColor: Colors.border,
        padding: Spacing.md,
        gap: Spacing.sm,
    },
    modalTitle: { ...Typography.heading, fontSize: 18, marginBottom: Spacing.xs },
    conflictText: { ...Typography.muted, marginBottom: Spacing.sm },
    conflictColumns: { flexDirection: 'row', gap: Spacing.sm },
    conflictCol: {
        flex: 1,
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: Radius.md,
        padding: Spacing.xs,
        maxHeight: 180,
    },
    conflictHeading: { ...Typography.subheading, fontSize: 13, marginBottom: 6 },
    conflictItem: {
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: Radius.sm,
        padding: 6,
        marginBottom: 6,
    },
    modalInput: {
        ...Typography.body,
        backgroundColor: Colors.surfaceElevated,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.border,
        paddingHorizontal: Spacing.md,
        paddingVertical: 10,
        marginBottom: Spacing.xs,
    },
    modalInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        marginBottom: Spacing.xs,
    },
    eyeBtn: {
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: Spacing.sm,
        marginTop: Spacing.sm,
    },
    modalBtnSecondary: {
        paddingHorizontal: Spacing.md,
        paddingVertical: 10,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    modalBtnSecondaryText: { ...Typography.body, fontSize: 13 },
    modalBtnPrimary: {
        paddingHorizontal: Spacing.md,
        paddingVertical: 10,
        borderRadius: Radius.md,
        backgroundColor: Colors.primary,
    },
    modalBtnPrimaryText: {
        color: Colors.background,
        fontSize: 13,
        fontWeight: '700',
    },
});
