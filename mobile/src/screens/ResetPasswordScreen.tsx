import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import axios from 'axios';
import { deriveKey, decryptVault, encryptVault, generateVerifier } from '@password-manager/crypto-engine';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../config';
import { Colors, Radius, Spacing, Typography } from '../theme';
import { SecureStorageService } from '../services/secureStorage';
import { useAuthStore } from '../store/authStore';
import { useVaultStore } from '../store/vaultStore';

function toHex(bytes: Uint8Array): string {
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

export default function ResetPasswordScreen({ navigation }: any) {
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPasswords, setShowPasswords] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const {
        userId,
        recoveryEmail,
        recoveredMasterPassword,
        clearRecoveryContext,
        setMasterKey,
        logout,
    } = useAuthStore();
    const { getDeviceIdForSync } = useVaultStore();

    const handleReset = async () => {
        if (!newPassword.trim() || !confirmPassword.trim()) {
            Alert.alert('Missing Input', 'Please enter and confirm your new password.');
            return;
        }

        if (newPassword !== confirmPassword) {
            Alert.alert('Password Mismatch', 'Passwords do not match.');
            return;
        }

        if (newPassword.length < 8) {
            Alert.alert('Weak Password', 'Password must be at least 8 characters.');
            return;
        }

        const token = await SecureStorageService.getSessionId();
        if (!token || !userId) {
            Alert.alert('Session Required', 'Recovery session expired. Please login with recovery key again.');
            navigation.replace('RecoveryLogin');
            return;
        }

        setIsSubmitting(true);
        try {
            const saltBuffer = crypto.getRandomValues(new Uint8Array(16));
            const salt = toHex(saltBuffer);
            const { authKey } = await deriveKey(newPassword, saltBuffer);
            const verifier = await generateVerifier(authKey);

            let encryptedVaultPayload: any = undefined;

            if (recoveredMasterPassword) {
                try {
                    const vaultResponse = await axios.get(`${API_URL}/api/vault/${encodeURIComponent(userId)}`, {
                        headers: { Authorization: `Bearer ${token}` },
                    });

                    const vaultData = vaultResponse.data;
                    if (vaultData?.ciphertext) {
                        const decryptResult = await decryptVault(recoveredMasterPassword, {
                            ciphertext: vaultData.ciphertext,
                            iv: vaultData.iv,
                            salt: vaultData.salt,
                            tag: vaultData.tag || vaultData.authTag,
                            algorithm: 'AES-256-GCM',
                            derivationAlgorithm: 'Argon2id',
                        });

                        if (decryptResult.success && decryptResult.data) {
                            const reEncrypted = await encryptVault(newPassword, decryptResult.data);
                            encryptedVaultPayload = {
                                ciphertext: reEncrypted.ciphertext,
                                iv: reEncrypted.iv,
                                salt: reEncrypted.salt,
                                authTag: reEncrypted.tag,
                                version: (vaultData.version || 0) + 1,
                                deviceId: await getDeviceIdForSync(),
                            };
                        }
                    }
                } catch (e) {
                    console.warn('[ResetPassword] Vault re-encryption skipped:', e);
                }
            }

            await axios.post(
                `${API_URL}/auth/reset-password`,
                {
                    salt,
                    verifier,
                    encryptedVault: encryptedVaultPayload,
                },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                },
            );

            clearRecoveryContext();
            setMasterKey(null);
            await logout();

            Alert.alert('Password Reset', 'Password reset successful. Please sign in with your new password.', [
                {
                    text: 'OK',
                    onPress: () => navigation.replace('Login'),
                },
            ]);
        } catch (e: any) {
            const message = e?.response?.data?.message || e?.response?.data?.error || e?.message || 'Failed to reset password';
            Alert.alert('Reset Failed', message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Set New Password</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.content}>
                <Text style={styles.helperText}>
                    {recoveryEmail
                        ? `Resetting password for ${recoveryEmail}`
                        : 'Set a new master password for your account.'}
                </Text>

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

                <TouchableOpacity style={styles.toggleVisibility} onPress={() => setShowPasswords((v) => !v)}>
                    <Ionicons name={showPasswords ? 'eye-off-outline' : 'eye-outline'} size={16} color={Colors.textMuted} />
                    <Text style={styles.toggleText}>{showPasswords ? 'Hide passwords' : 'Show passwords'}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.submitBtn, isSubmitting && { opacity: 0.7 }]} onPress={handleReset} disabled={isSubmitting}>
                    {isSubmitting ? <ActivityIndicator color={Colors.background} /> : <Text style={styles.submitText}>Reset Password</Text>}
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
    submitText: { color: Colors.background, fontSize: 15, fontWeight: '700' },
});
