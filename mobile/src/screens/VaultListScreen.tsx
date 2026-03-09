import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    SectionList,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    RefreshControl,
    Alert,
    Clipboard,
    Modal,
    Platform,
    StatusBar,
    Image,
} from 'react-native';
import { useVaultStore, type VaultEntryLocal } from '../store/vaultStore';
import { useAuthStore } from '../store/authStore';
import { Colors, Spacing, Radius, Typography } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import { API_URL } from '../config';
import { usePasswordAging } from '../hooks/usePasswordAging';

function generatePassword(length = 20): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    const array = new Uint8Array(length);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        crypto.getRandomValues(array);
    } else {
        // Fallback for environments where crypto is not available
        for (let i = 0; i < length; i++) {
            array[i] = Math.floor(Math.random() * 256);
        }
    }
    return Array.from(array).map(x => chars[x % chars.length]).join('');
}

function InputField({
    label, value, onChangeText, placeholder, secureTextEntry = false, icon, rightSlot, multiline = false,
}: {
    label: string;
    value: string;
    onChangeText: (v: string) => void;
    placeholder?: string;
    secureTextEntry?: boolean;
    icon?: string;
    rightSlot?: React.ReactNode;
    multiline?: boolean;
}) {
    return (
        <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>{label}</Text>
            <View style={styles.fieldRow}>
                {icon && <Ionicons name={icon as any} size={16} color={Colors.textMuted} style={{ marginRight: 8 }} />}
                <TextInput
                    style={[styles.fieldInput, multiline && { height: 80, textAlignVertical: 'top' }]}
                    value={value}
                    onChangeText={onChangeText}
                    placeholder={placeholder}
                    placeholderTextColor={Colors.textMuted}
                    secureTextEntry={secureTextEntry}
                    multiline={multiline}
                    autoCapitalize="none"
                    autoCorrect={false}
                />
                {rightSlot}
            </View>
        </View>
    );
}

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
    const [imageError, setImageError] = useState(false);
    const { isPasswordOld, isSnoozed, snoozeEntry } = usePasswordAging();

    const copyToClipboard = (text: string, type: 'user' | 'pass') => {
        Clipboard.setString(text);
        setCopied(type);
        setTimeout(() => setCopied(null), 2000);
        setTimeout(() => Clipboard.setString(''), 30000);
    };

    const confirmDelete = () => {
        Alert.alert('Delete Credential', `Remove "${entry.url}"?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => onDelete(entry.id) },
        ]);
    };

    const initials = entry.url?.charAt(0).toUpperCase() || '?';
    const showWarning = isPasswordOld(entry) && !isSnoozed(entry);
    const faviconUrl = entry.url ? `https://www.google.com/s2/favicons?domain=${entry.url}&sz=64` : null;

    return (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View style={styles.siteAvatar}>
                    {(faviconUrl && !imageError) ? (
                        <Image 
                            source={{ uri: faviconUrl }} 
                            style={{ width: 24, height: 24, borderRadius: Radius.xs }} 
                            onError={() => setImageError(true)}
                        />
                    ) : (
                        <Text style={styles.siteInitial}>{initials}</Text>
                    )}
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.siteName}>{entry.url}</Text>
                    <Text style={styles.siteUsername}>{entry.username}</Text>
                </View>
                <TouchableOpacity onPress={() => onEdit(entry)} style={styles.iconBtn}>
                    <Ionicons name="create-outline" size={18} color={Colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={confirmDelete} style={styles.iconBtn}>
                    <Ionicons name="trash-outline" size={18} color={Colors.destructive} />
                </TouchableOpacity>
            </View>

            {showWarning && (
                <View style={styles.warningBox}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <Ionicons name="alert-circle" size={16} color="#F59E0B" style={{ marginRight: 6 }} />
                        <Text style={styles.warningText}>Password is over 365 days old</Text>
                    </View>
                    <TouchableOpacity style={styles.snoozeBtn} onPress={() => snoozeEntry(entry.id)}>
                        <Text style={styles.snoozeBtnText}>Snooze 7d</Text>
                    </TouchableOpacity>
                </View>
            )}

            <View style={styles.cardActions}>
                <TouchableOpacity style={styles.copyBtn} onPress={() => copyToClipboard(entry.password, 'pass')}>
                    <Ionicons name={copied === 'pass' ? 'checkmark' : 'copy-outline'} size={14} color={Colors.primary} />
                    <Text style={styles.copyBtnText}>{copied === 'pass' ? 'Copied!' : 'Password'}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.copyBtn} onPress={() => setRevealed((r) => !r)}>
                    <Ionicons name={revealed ? 'eye-off-outline' : 'eye-outline'} size={14} color={Colors.primary} />
                    <Text style={styles.copyBtnText}>{revealed ? 'Hide' : 'Reveal'}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.copyBtn} onPress={() => copyToClipboard(entry.username, 'user')}>
                    <Ionicons name={copied === 'user' ? 'checkmark' : 'person-outline'} size={14} color={Colors.primary} />
                    <Text style={styles.copyBtnText}>{copied === 'user' ? 'Copied!' : 'Username'}</Text>
                </TouchableOpacity>
            </View>

            {(revealed || (!!entry.notes && revealed)) && (
                <View style={styles.revealedPw}>
                    {revealed && <Text style={styles.revealedPwText}>{entry.password}</Text>}
                    {!!entry.notes && <Text style={styles.notesText}>{entry.notes}</Text>}
                </View>
            )}
        </View>
    );
}

export default function VaultListScreen() {
    const { masterKey, userId } = useAuthStore();
    const { entries, isLoading, isSyncing, loadVault, deleteEntry, updateEntry, addEntry, syncConflict, resolveSyncConflict } = useVaultStore();
    const [search, setSearch] = useState('');
    const [editingEntry, setEditingEntry] = useState<VaultEntryLocal | null>(null);
    const [editUsername, setEditUsername] = useState('');
    const [editPassword, setEditPassword] = useState('');
    const [editUrl, setEditUrl] = useState('');
    const [editNotes, setEditNotes] = useState('');
    const [showEditPassword, setShowEditPassword] = useState(false);
    const [isManualSyncing, setIsManualSyncing] = useState(false);
    const [isResolvingConflict, setIsResolvingConflict] = useState(false);
    const navigation = useNavigation<any>();
    const activeCredentialCount = entries.filter((entry) => entry && entry.id && entry.url).length;

    useEffect(() => {
        if (masterKey && userId) {
            loadVault(masterKey, userId);
        }
    }, [masterKey, userId]);


    const filtered = entries.filter((e) =>
        e.url?.toLowerCase().includes(search.toLowerCase()) ||
        e.username?.toLowerCase().includes(search.toLowerCase()),
    );

    const handleDelete = async (id: string) => {
        if (masterKey && userId) await deleteEntry(id, masterKey, userId);
    };

    const openEdit = (entry: VaultEntryLocal) => {
        setEditingEntry(entry);
        setEditUsername(entry.username || '');
        setEditPassword(entry.password || '');
        setEditUrl(entry.url || '');
        setEditNotes(entry.notes || '');
    };

    const saveEdit = async () => {
        if (!editingEntry || !masterKey || !userId) return;
        if (!editUrl.trim() || !editUsername.trim() || !editPassword.trim()) {
            Alert.alert('Invalid Input', 'URL, username, and password are required.');
            return;
        }

        await updateEntry(
            {
                ...editingEntry,
                url: editUrl.trim(),
                username: editUsername.trim(),
                password: editPassword,
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



    const handleResolveConflict = async (choice: 'local' | 'server' | 'merge') => {
        if (!masterKey || !userId) return;
        setIsResolvingConflict(true);
        try {
            const ok = await resolveSyncConflict(choice, masterKey, userId);
            if (ok) {
                let msg = choice === 'local' ? 'Kept your local version.' : choice === 'server' ? 'Kept server version.' : 'Merged changes from both devices.';
                Alert.alert('Conflict Resolved', msg);
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
                    <Text style={styles.headerSub}>{activeCredentialCount} credential{activeCredentialCount !== 1 ? 's' : ''}</Text>
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
                <SectionList
                    sections={((): Array<{ title: string; data: VaultEntryLocal[] }> => {
                        const groups = filtered.reduce((acc: Record<string, VaultEntryLocal[]>, entry: VaultEntryLocal) => {
                            const url = entry.url || 'No URL';
                            if (!acc[url]) acc[url] = [];
                            acc[url].push(entry);
                            return acc;
                        }, {});
                        
                        return Object.keys(groups)
                            .sort((a: string, b: string) => a.localeCompare(b))
                            .map((url: string) => ({ title: url, data: groups[url] }));
                    })()}
                    keyExtractor={(item: VaultEntryLocal) => item.id}
                    renderItem={({ item }: { item: VaultEntryLocal }) => (
                        <VaultCard 
                            entry={item} 
                            onDelete={handleDelete} 
                            onEdit={openEdit} 
                        />
                    )}
                    renderSectionHeader={({ section: { title } }: { section: { title: string } }) => (
                        <View style={styles.sectionHeader}>
                            <Ionicons name="link-outline" size={14} color={Colors.primary} style={{ marginRight: 6 }} />
                            <Text style={styles.sectionTitle}>{title}</Text>
                        </View>
                    )}
                    contentContainerStyle={{ padding: Spacing.md, paddingBottom: 100 }}
                    stickySectionHeadersEnabled={false}
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
                        <View style={styles.modalHeader}>
                            <View>
                                <View style={styles.modalTitleRow}>
                                    <Ionicons name="create-outline" size={20} color={Colors.primary} style={{ marginRight: 8 }} />
                                    <Text style={styles.modalTitle}>Edit Credential</Text>
                                </View>
                                <Text style={styles.modalSubtitle}>Update your stored credential information</Text>
                            </View>
                            <TouchableOpacity onPress={() => setEditingEntry(null)} style={styles.modalCloseBtn}>
                                <Ionicons name="close" size={24} color={Colors.textMuted} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.modalBody}>
                            <InputField
                                label="URL"
                                value={editUrl}
                                onChangeText={setEditUrl}
                                placeholder="https://example.com"
                                icon="globe-outline"
                            />
                            
                            <InputField
                                label="Username / Email"
                                value={editUsername}
                                onChangeText={setEditUsername}
                                placeholder="your@email.com"
                                icon="person-outline"
                            />

                            <View style={styles.fieldContainer}>
                                <View style={styles.passwordLabelRow}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Text style={styles.fieldLabel}>Password</Text>
                                    </View>
                                    <TouchableOpacity 
                                        onPress={() => setEditPassword(generatePassword())} 
                                        style={styles.generateBtn}
                                    >
                                        <Ionicons name="sparkles" size={10} color={Colors.primary} />
                                        <Text style={styles.generateBtnText}>Generate</Text>
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.fieldRow}>
                                    <Ionicons name="key-outline" size={16} color={Colors.textMuted} style={{ marginRight: 8 }} />
                                    <TextInput
                                        style={[styles.fieldInput, { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }]}
                                        value={editPassword}
                                        onChangeText={setEditPassword}
                                        placeholder="Enter password"
                                        placeholderTextColor={Colors.textMuted}
                                        secureTextEntry={!showEditPassword}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                    />
                                    <TouchableOpacity onPress={() => setShowEditPassword(v => !v)} style={{ padding: 4 }}>
                                        <Ionicons name={showEditPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textMuted} />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <InputField
                                label="Notes (optional)"
                                value={editNotes}
                                onChangeText={setEditNotes}
                                placeholder="Additional information"
                                multiline
                                icon="document-text-outline"
                            />
                        </View>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity style={styles.modalBtnSecondary} onPress={() => setEditingEntry(null)}>
                                <Text style={styles.modalBtnSecondaryText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalBtnPrimary} onPress={saveEdit}>
                                <Ionicons name="shield-checkmark" size={16} color={Colors.background} style={{ marginRight: 6 }} />
                                <Text style={styles.modalBtnPrimaryText}>Save Changes</Text>
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
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    modalTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    modalSubtitle: {
        ...Typography.muted,
        fontSize: 12,
        marginTop: 2,
    },
    modalCloseBtn: {
        padding: 4,
    },
    modalBody: {
        gap: Spacing.md,
    },
    modalFooter: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: Spacing.sm,
        marginTop: Spacing.lg,
        paddingTop: Spacing.md,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
    },
    fieldContainer: {
        gap: 6,
    },
    fieldLabel: {
        ...Typography.muted,
        fontSize: 12,
        fontWeight: '600',
        color: Colors.textMuted,
    },
    fieldRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surfaceElevated,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.border,
        paddingHorizontal: Spacing.md,
        paddingVertical: 10,
    },
    fieldInput: {
        flex: 1,
        ...Typography.body,
        fontSize: 15,
        padding: 0,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.sm,
        paddingVertical: Spacing.sm,
        marginTop: Spacing.md,
        marginBottom: Spacing.xs,
        backgroundColor: 'rgba(255, 215, 0, 0.05)',
        borderRadius: Radius.sm,
    },
    sectionTitle: {
        ...Typography.subheading,
        fontSize: 14,
        color: Colors.primary,
        fontWeight: '700',
    },
    warningBox: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        padding: 10,
        borderRadius: Radius.md,
        marginTop: 8,
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.2)',
    },
    warningText: {
        color: '#F59E0B',
        fontSize: 11,
        fontWeight: '600',
    },
    snoozeBtn: {
        backgroundColor: 'rgba(245, 158, 11, 0.2)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: Radius.sm,
    },
    snoozeBtnText: {
        color: '#F59E0B',
        fontSize: 10,
        fontWeight: '700',
    },
    passwordLabelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    generateBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: Colors.primaryDim,
        borderRadius: Radius.sm,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderWidth: 1,
        borderColor: Colors.primaryBorder,
    },
    generateBtnText: {
        color: Colors.primary,
        fontSize: 10,
        fontWeight: '700',
    },
    modalTitle: { ...Typography.heading, fontSize: 18 },
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
    modalActionsVertical: {
        marginTop: Spacing.md,
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
    incomingShareItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: Colors.surfaceElevated,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.border,
        marginBottom: 8,
    },
    shareActionBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
