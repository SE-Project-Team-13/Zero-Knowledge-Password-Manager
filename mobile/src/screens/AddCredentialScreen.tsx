import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity,
    ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native';
import { useAuthStore } from '../store/authStore';
import { useVaultStore } from '../store/vaultStore';
import { Colors, Spacing, Radius, Typography } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';

function generatePassword(length = 20): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    const array = new Uint8Array(length);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        crypto.getRandomValues(array);
    } else {
        // Fallback for environments where crypto is not available (e.g. older React Native versions on Android)
        // This is not cryptographically secure and should be avoided in production.
        console.warn('Using insecure fallback for password generation. Please ensure a modern environment with crypto.getRandomValues.');
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

export default function AddCredentialScreen() {
    const navigation = useNavigation<any>();
    const { masterKey, userId } = useAuthStore();
    const { addEntry, isSyncing } = useVaultStore();

    const [url, setUrl] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [notes, setNotes] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const handleSave = async () => {
        if (!url.trim() || !username.trim() || !password.trim()) {
            Alert.alert('Missing Fields', 'Please fill in URL, username, and password.');
            return;
        }
        if (!masterKey || !userId) {
            Alert.alert('Error', 'Session expired. Please log in again.');
            return;
        }
        try {
            await addEntry({ url: url.trim(), username: username.trim(), password, notes }, masterKey, userId);
            navigation.goBack();
        } catch (e) {
            Alert.alert('Error', (e as Error).message);
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <LinearGradient
                colors={[Colors.background, '#080808', '#121212']}
                style={styles.gradient}
            >
                <KeyboardAvoidingView 
                    style={{ flex: 1 }} 
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                            <Ionicons name="arrow-back" size={24} color={Colors.text} />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Add Credential</Text>
                        <View style={{ width: 40 }} />
                    </View>

                    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                        <View style={styles.mainContent}>
                            <View style={styles.pageHeader}>
                                <View style={styles.iconCircleLarge}>
                                    <Ionicons name="add" size={32} color={Colors.primary} />
                                </View>
                                <View style={styles.headerTextContainer}>
                                    <Text style={styles.pageTitle}>New Credential</Text>
                                    <Text style={styles.pageSubtitle}>Securely store a new password in your vault</Text>
                                </View>
                            </View>

                            <View style={styles.card}>
                                <View style={styles.cardHeader}>
                                    <Ionicons name="shield-checkmark-outline" size={18} color={Colors.primary} />
                                    <Text style={styles.cardTitle}>Credential Details</Text>
                                </View>
                                <Text style={styles.cardDescription}>All data is encrypted before syncing.</Text>

                                <InputField
                                    label="URL"
                                    value={url}
                                    onChangeText={setUrl}
                                    placeholder="example.com or https://example.com"
                                    icon="globe-outline"
                                />

                                <InputField
                                    label="Username / Email"
                                    value={username}
                                    onChangeText={setUsername}
                                    placeholder="Enter your username"
                                    icon="person-outline"
                                />

                                <View style={styles.fieldContainer}>
                                    <View style={styles.passwordLabelRow}>
                                        <Text style={styles.fieldLabel}>Password</Text>
                                        <TouchableOpacity onPress={() => setPassword(generatePassword())} style={styles.generateBtn}>
                                            <Ionicons name="sparkles" size={12} color={Colors.primary} />
                                            <Text style={styles.generateBtnText}>Generate</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <View style={styles.fieldRow}>
                                        <Ionicons name="key-outline" size={16} color={Colors.textMuted} style={{ marginRight: 8 }} />
                                        <TextInput
                                            style={[styles.fieldInput, { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }]}
                                            value={password}
                                            onChangeText={setPassword}
                                            placeholder="Enter or generate a password"
                                            placeholderTextColor={Colors.textMuted}
                                            secureTextEntry={!showPassword}
                                            autoCapitalize="none"
                                            autoCorrect={false}
                                        />
                                        <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={{ padding: 4 }}>
                                            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textMuted} />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <InputField
                                    label="Notes (optional)"
                                    value={notes}
                                    onChangeText={setNotes}
                                    placeholder="Add any notes..."
                                    multiline
                                    icon="document-text-outline"
                                />

                                <View style={styles.actionRow}>
                                    <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
                                        <Text style={styles.cancelBtnText}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={isSyncing}>
                                        {isSyncing ? (
                                            <ActivityIndicator color={Colors.background} />
                                        ) : (
                                            <Text style={styles.saveBtnText}>Save Password</Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View style={styles.footer}>
                                <View style={styles.securityBadge}>
                                    <Ionicons name="lock-closed" size={12} color={Colors.textMuted} />
                                    <Text style={styles.securityText}>AES-256-GCM Encryption</Text>
                                </View>
                            </View>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    gradient: { flex: 1 },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.md, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: Spacing.md,
    },
    backBtn: { width: 40, height: 40, justifyContent: 'center' },
    headerTitle: { ...Typography.heading, fontSize: 18 },
    scrollContent: { flexGrow: 1 },
    mainContent: { padding: Spacing.md, gap: Spacing.lg },
    pageHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.sm },
    iconCircleLarge: {
        width: 56, height: 56, borderRadius: Radius.lg,
        backgroundColor: Colors.primaryDim,
        borderWidth: 1, borderColor: Colors.primaryBorder,
        justifyContent: 'center', alignItems: 'center',
    },
    headerTextContainer: { flex: 1 },
    pageTitle: { ...Typography.heading, fontSize: 24 },
    pageSubtitle: { ...Typography.muted, fontSize: 13, marginTop: 2 },
    card: {
        backgroundColor: Colors.surface + '99',
        borderRadius: Radius.lg,
        borderWidth: 1, borderColor: Colors.border,
        padding: Spacing.lg,
        gap: Spacing.md,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    cardTitle: { ...Typography.subheading, fontSize: 18 },
    cardDescription: { ...Typography.muted, fontSize: 12, marginBottom: Spacing.xs },
    fieldContainer: { gap: 8 },
    fieldLabel: { ...Typography.muted, fontSize: 13, fontWeight: '600', color: Colors.textMuted },
    fieldRow: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: Colors.surfaceElevated,
        borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
        paddingHorizontal: Spacing.md, paddingVertical: 12,
    },
    fieldInput: { flex: 1, ...Typography.body, fontSize: 15, padding: 0 },
    passwordLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    generateBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: Colors.primaryDim, borderRadius: Radius.sm,
        paddingHorizontal: 10, paddingVertical: 4,
        borderWidth: 1, borderColor: Colors.primaryBorder,
    },
    generateBtnText: { color: Colors.primary, fontSize: 11, fontWeight: '700' },
    actionRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md },
    cancelBtn: {
        flex: 1, height: 52, borderRadius: Radius.md,
        borderWidth: 1, borderColor: Colors.border,
        justifyContent: 'center', alignItems: 'center',
    },
    cancelBtnText: { ...Typography.body, fontWeight: '600' },
    saveBtn: {
        flex: 1, height: 52, borderRadius: Radius.md,
        backgroundColor: Colors.primary,
        justifyContent: 'center', alignItems: 'center',
        shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
    },
    saveBtnText: { color: Colors.background, fontSize: 15, fontWeight: '700' },
    footer: { alignItems: 'center', marginTop: Spacing.md },
    securityBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: 'rgba(255,255,255,0.03)',
        paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full,
    },
    securityText: { fontSize: 11, color: Colors.textDim, fontWeight: '500' },
});
