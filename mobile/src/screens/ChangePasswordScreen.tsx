import React, { useMemo, useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    ActivityIndicator,
} from 'react-native';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import { deriveKey, encrypt, generateVerifier, type VaultEntry } from '@password-manager/crypto-engine';
import { useAuthStore } from '../store/authStore';
import { useVaultStore } from '../store/vaultStore';
import { SecureStorageService } from '../services/secureStorage';
import { API_URL } from '../config';
import { Colors, Radius, Spacing, Typography } from '../theme';
import PasswordStrength from '../components/PasswordStrength';

function toHex(bytes: Uint8Array): string {
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

export default function ChangePasswordScreen({ navigation }: any) {
    const { userId, masterKey, setMasterKey } = useAuthStore();
    const { entries, version, clearVault, getDeviceIdForSync } = useVaultStore();

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPasswords, setShowPasswords] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isPasswordValid, setIsPasswordValid] = useState(false);

    const canSubmit = useMemo(() => {
        return (
            currentPassword.trim().length > 0 &&
            isPasswordValid &&
            confirmPassword.trim().length >= 8 &&
            !isSubmitting
        );
    }, [currentPassword, isPasswordValid, confirmPassword, isSubmitting]);

    const handleSubmit = async () => {
        if (!userId || !masterKey) {
            Alert.alert('Session Required', 'Please sign in again to change your password.');
            return;
        }

        if (newPassword !== confirmPassword) {
            Alert.alert('Password Mismatch', 'New passwords do not match.');
            return;
        }

        if (newPassword === currentPassword) {
            Alert.alert('Invalid Password', 'New password must be different from current password.');
            return;
        }

        setIsSubmitting(true);
        try {
            const newSaltBuffer = crypto.getRandomValues(new Uint8Array(16));
            const newSaltHex = toHex(newSaltBuffer);
            const newDerivedKey = await deriveKey(newPassword, newSaltBuffer);
            const verifier = await generateVerifier(newDerivedKey.authKey);

            const serializedVault: VaultEntry = {
                site: '__vault__',
                username: '__vault__',
                password: JSON.stringify(entries),
                metadata: { isVaultBlob: true },
            };

            const encryptedVault = await encrypt(serializedVault, newDerivedKey);
            const token = await SecureStorageService.getSessionId();
            const deviceId = await getDeviceIdForSync();

            if (!token) {
                throw new Error('Missing session token. Please sign in again.');
            }

            await axios.post(
                `${API_URL}/auth/reset-password`,
                {
                    salt: newSaltHex,
                    verifier,
                    encryptedVault: {
                        ciphertext: encryptedVault.ciphertext,
                        iv: encryptedVault.iv,
                        salt: encryptedVault.salt,
                        authTag: encryptedVault.tag,
                        version: version + 1,
                        deviceId,
                    },
                },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                },
            );

            setMasterKey(newDerivedKey);
            Alert.alert('Password Updated', 'Master password updated successfully.', [
                {
                    text: 'OK',
                    onPress: () => navigation.goBack(),
                },
            ]);
        } catch (error: any) {
            const message = error?.response?.data?.message || error?.message || 'Failed to update password';
            Alert.alert('Update Failed', message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Change Password</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.content}>
                <Text style={styles.helperText}>
                    This re-encrypts your vault using your new master password.
                </Text>

                <View style={styles.inputBlock}>
                    <Text style={styles.label}>Current Password</Text>
                    <TextInput
                        style={styles.input}
                        value={currentPassword}
                        onChangeText={setCurrentPassword}
                        secureTextEntry={!showPasswords}
                        placeholder="Enter current password"
                        placeholderTextColor={Colors.textMuted}
                    />
                </View>

                <View style={styles.inputBlock}>
                    <Text style={styles.label}>New Password</Text>
                    <TextInput
                        style={styles.input}
                        value={newPassword}
                        onChangeText={setNewPassword}
                        secureTextEntry={!showPasswords}
                        placeholder="Minimum 8 characters"
                        placeholderTextColor={Colors.textMuted}
                    />
                </View>

                <View style={styles.inputBlock}>
                    <Text style={styles.label}>Confirm New Password</Text>
                    <TextInput
                        style={styles.input}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry={!showPasswords}
                        placeholder="Repeat new password"
                        placeholderTextColor={Colors.textMuted}
                    />
                </View>

                <PasswordStrength 
                    password={newPassword} 
                    onStrengthChange={setIsPasswordValid} 
                />

                <TouchableOpacity style={styles.toggleVisibility} onPress={() => setShowPasswords((v) => !v)}>
                    <Ionicons name={showPasswords ? 'eye-off-outline' : 'eye-outline'} size={16} color={Colors.textMuted} />
                    <Text style={styles.toggleText}>{showPasswords ? 'Hide passwords' : 'Show passwords'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.submitBtn, !canSubmit && { opacity: 0.6 }]}
                    disabled={!canSubmit}
                    onPress={handleSubmit}
                >
                    {isSubmitting ? (
                        <ActivityIndicator color={Colors.background} />
                    ) : (
                        <Text style={styles.submitText}>Update Password</Text>
                    )}
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.md,
        paddingTop: 60,
        paddingBottom: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    backBtn: { width: 40, height: 40, justifyContent: 'center' },
    headerTitle: { ...Typography.heading, fontSize: 18 },
    content: { padding: Spacing.md, gap: Spacing.md },
    helperText: { ...Typography.muted, fontSize: 13, lineHeight: 20 },
    inputBlock: { gap: 6 },
    label: { ...Typography.muted, fontSize: 12, fontWeight: '600' },
    input: {
        ...Typography.body,
        backgroundColor: Colors.surface,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.border,
        paddingHorizontal: Spacing.md,
        paddingVertical: 12,
    },
    toggleVisibility: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    toggleText: { ...Typography.muted, fontSize: 12 },
    submitBtn: {
        marginTop: Spacing.md,
        backgroundColor: Colors.primary,
        borderRadius: Radius.md,
        paddingVertical: 14,
        alignItems: 'center',
    },
    submitText: {
        color: Colors.background,
        fontSize: 15,
        fontWeight: '700',
    },
});
