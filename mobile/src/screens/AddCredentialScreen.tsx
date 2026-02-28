import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity,
    ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useAuthStore } from '../store/authStore';
import { useVaultStore } from '../store/vaultStore';
import { Colors, Spacing, Radius, Typography } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

function generatePassword(length = 20): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
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

    const [site, setSite] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [notes, setNotes] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const handleSave = async () => {
        if (!site.trim() || !username.trim() || !password.trim()) {
            Alert.alert('Missing Fields', 'Please fill in site, username, and password.');
            return;
        }
        if (!masterKey || !userId) {
            Alert.alert('Error', 'Session expired. Please log in again.');
            return;
        }
        try {
            await addEntry({ site: site.trim(), username: username.trim(), password, notes, siteUrl: '' }, masterKey, userId);
            navigation.goBack();
        } catch (e) {
            Alert.alert('Error', (e as Error).message);
        }
    };

    return (
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: Colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Add Credential</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.form}>
                <View style={styles.iconBanner}>
                    <View style={styles.iconCircle}>
                        <Ionicons name="key" size={28} color={Colors.primary} />
                    </View>
                    <Text style={styles.bannerText}>New password will be end-to-end encrypted</Text>
                </View>

                <InputField
                    label="Website / App"
                    value={site}
                    onChangeText={setSite}
                    placeholder="e.g. github.com"
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
                            <Ionicons name="shuffle" size={12} color={Colors.primary} />
                            <Text style={styles.generateBtnText}>Generate</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.fieldRow}>
                        <Ionicons name="lock-closed-outline" size={16} color={Colors.textMuted} style={{ marginRight: 8 }} />
                        <TextInput
                            style={[styles.fieldInput, { fontFamily: 'Courier New' }]}
                            value={password}
                            onChangeText={setPassword}
                            placeholder="Enter or generate a password"
                            placeholderTextColor={Colors.textMuted}
                            secureTextEntry={!showPassword}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                        <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={{ padding: 4 }}>
                            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={16} color={Colors.textMuted} />
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

                <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={isSyncing}>
                    {isSyncing ? (
                        <ActivityIndicator color={Colors.background} />
                    ) : (
                        <>
                            <Ionicons name="shield-checkmark" size={18} color={Colors.background} />
                            <Text style={styles.saveBtnText}>Encrypt & Save</Text>
                        </>
                    )}
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.md, paddingTop: 60, paddingBottom: Spacing.md,
        borderBottomWidth: 1, borderBottomColor: Colors.border,
        backgroundColor: Colors.background,
    },
    backBtn: { width: 40, height: 40, justifyContent: 'center' },
    headerTitle: { ...Typography.heading, fontSize: 18 },
    form: { padding: Spacing.md, gap: Spacing.md },
    iconBanner: {
        flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
        backgroundColor: Colors.primaryDim, borderRadius: Radius.md,
        padding: Spacing.md, borderWidth: 1, borderColor: Colors.primaryBorder,
        marginBottom: Spacing.sm,
    },
    iconCircle: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: Colors.primary + '22',
        justifyContent: 'center', alignItems: 'center',
    },
    bannerText: { ...Typography.muted, flex: 1, fontSize: 13 },
    fieldContainer: { gap: 6 },
    fieldLabel: { ...Typography.muted, fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
    fieldRow: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: Colors.surface,
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
    generateBtnText: { color: Colors.primary, fontSize: 12, fontWeight: '600' },
    saveBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        backgroundColor: Colors.primary, borderRadius: Radius.md,
        paddingVertical: 16, marginTop: Spacing.sm,
        shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4, shadowRadius: 12, elevation: 6,
    },
    saveBtnText: { color: Colors.background, fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
});
