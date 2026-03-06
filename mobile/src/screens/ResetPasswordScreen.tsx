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
    StatusBar,
    ScrollView,
} from 'react-native';
import axios from 'axios';
import { deriveKey, decryptVault, encryptVault, generateVerifier } from '@password-manager/crypto-engine';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../config';
import { Colors, Radius, Spacing, Typography } from '../theme';
import { SecureStorageService } from '../services/secureStorage';
import PasswordStrength from '../components/PasswordStrength';
import { useAuthStore } from '../store/authStore';
import { useVaultStore } from '../store/vaultStore';
import { LinearGradient } from 'expo-linear-gradient';

function toHex(bytes: Uint8Array): string {
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

function InputField({
    label, value, onChangeText, placeholder, secureTextEntry = false, icon,
}: {
    label: string;
    value: string;
    onChangeText: (v: string) => void;
    placeholder?: string;
    secureTextEntry?: boolean;
    icon?: string;
}) {
    return (
        <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>{label}</Text>
            <View style={styles.fieldRow}>
                {icon && <Ionicons name={icon as any} size={16} color={Colors.textMuted} style={{ marginRight: 8 }} />}
                <TextInput
                    style={styles.fieldInput}
                    value={value}
                    onChangeText={onChangeText}
                    placeholder={placeholder}
                    placeholderTextColor={Colors.textMuted}
                    secureTextEntry={secureTextEntry}
                    autoCapitalize="none"
                    autoCorrect={false}
                />
            </View>
        </View>
    );
}

export default function ResetPasswordScreen({ navigation }: any) {
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPasswords, setShowPasswords] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isPasswordValid, setIsPasswordValid] = useState(false);

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

        if (!isPasswordValid) {
            Alert.alert('Weak Password', 'Please satisfy all security requirements.');
            return;
        }

        const token = await SecureStorageService.getSessionId();
        if (!token || !userId) {
            Alert.alert('Session Expired', 'Recovery session expired. Please start over.');
            navigation.replace('RecoveryLogin');
            return;
        }

        setIsSubmitting(true);
        try {
            const saltBuffer = crypto.getRandomValues(new Uint8Array(16));
            const salt = toHex(saltBuffer);
            const { authKey } = await deriveKey(newPassword, saltBuffer, {
                memorySize: 128,
                iterations: 1,
            });
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
                    console.warn('[ResetPassword] Re-encryption failed:', e);
                }
            }

            await axios.post(
                `${API_URL}/auth/reset-password`,
                { salt, verifier, encryptedVault: encryptedVaultPayload },
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

            Alert.alert('Success', 'Password reset successful. Please sign in.', [
                { text: 'Log In', onPress: () => navigation.replace('Login') },
            ]);
        } catch (e: any) {
            const message = e?.response?.data?.message || e?.message || 'Failed to reset password';
            Alert.alert('Error', message);
        } finally {
            setIsSubmitting(false);
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
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                            <Ionicons name="arrow-back" size={24} color={Colors.text} />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Account Recovery</Text>
                        <View style={{ width: 44 }} />
                    </View>

                    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                        <View style={styles.card}>
                            <View style={styles.infoBox}>
                                <Ionicons name="key" size={20} color={Colors.primary} />
                                <Text style={styles.infoText}>
                                    {recoveryEmail 
                                      ? `Resetting password for ${recoveryEmail}. Choose a strong new master password.`
                                      : 'Set a new master password to regain access to your vault.'}
                                </Text>
                            </View>

                            <InputField
                                label="New Master Password"
                                value={newPassword}
                                onChangeText={setNewPassword}
                                placeholder="Min. 8 characters"
                                icon="lock-closed-outline"
                                secureTextEntry={!showPasswords}
                            />

                            <PasswordStrength 
                                password={newPassword} 
                                onStrengthChange={setIsPasswordValid} 
                            />

                            <InputField
                                label="Confirm New Password"
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                placeholder="Repeat your new password"
                                icon="shield-checkmark-outline"
                                secureTextEntry={!showPasswords}
                            />

                            <TouchableOpacity 
                                style={styles.toggleVisibility} 
                                onPress={() => setShowPasswords((v) => !v)}
                            >
                                <Ionicons 
                                    name={showPasswords ? 'eye-off-outline' : 'eye-outline'} 
                                    size={16} 
                                    color={Colors.textMuted} 
                                />
                                <Text style={styles.toggleText}>
                                    {showPasswords ? 'Hide characters' : 'Show characters'}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.submitBtn, (isSubmitting || !isPasswordValid) && styles.submitBtnDisabled]}
                                disabled={isSubmitting || !isPasswordValid}
                                onPress={handleReset}
                            >
                                <LinearGradient
                                    colors={isPasswordValid ? [Colors.primary, '#EAB308'] : [Colors.border, Colors.border]}
                                    style={styles.submitGradient}
                                >
                                    {isSubmitting ? (
                                        <ActivityIndicator color={Colors.background} />
                                    ) : (
                                        <>
                                            <Ionicons name="refresh-circle" size={20} color={Colors.background} style={{ marginRight: 8 }} />
                                            <Text style={styles.submitText}>Reset & Secure Account</Text>
                                        </>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
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
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.md,
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingBottom: Spacing.md,
    },
    backBtn: {
        width: 44, height: 44,
        justifyContent: 'center', alignItems: 'center',
        backgroundColor: Colors.surface,
        borderRadius: 22,
        borderWidth: 1, borderColor: Colors.border,
    },
    headerTitle: { ...Typography.heading, fontSize: 18 },
    scrollContent: {
        padding: Spacing.lg,
        paddingBottom: 40,
    },
    card: {
        backgroundColor: Colors.surface + 'CC',
        borderRadius: Radius.xl,
        borderWidth: 1, borderColor: Colors.border,
        padding: Spacing.lg,
        gap: Spacing.lg,
    },
    infoBox: {
        flexDirection: 'row',
        backgroundColor: Colors.primaryDim,
        padding: Spacing.md,
        borderRadius: Radius.md,
        gap: 12,
        borderWidth: 1, borderColor: Colors.primaryBorder,
        marginBottom: 8,
    },
    infoText: {
        flex: 1,
        ...Typography.body,
        fontSize: 13,
        lineHeight: 18,
    },
    fieldContainer: { gap: 6 },
    fieldLabel: {
        ...Typography.muted,
        fontSize: 12,
        fontWeight: '600',
        color: Colors.textMuted,
        marginLeft: 4,
    },
    fieldRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surfaceElevated,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.border,
        paddingHorizontal: Spacing.md,
        paddingVertical: 12,
    },
    fieldInput: {
        flex: 1,
        ...Typography.body,
        fontSize: 15,
        padding: 0,
    },
    toggleVisibility: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 4,
    },
    toggleText: { ...Typography.muted, fontSize: 12 },
    submitBtn: {
        borderRadius: Radius.md,
        overflow: 'hidden',
        marginTop: Spacing.md,
    },
    submitBtnDisabled: {
        opacity: 0.5,
    },
    submitGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
    },
    submitText: {
        color: Colors.background,
        fontSize: 16,
        fontWeight: '700',
    },
});
