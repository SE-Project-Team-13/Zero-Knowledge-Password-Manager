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
    StatusBar,
    ScrollView,
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
import { LinearGradient } from 'expo-linear-gradient';

function toHex(bytes: Uint8Array): string {
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

function hexToBytes(hex: string): Uint8Array {
    const normalized = hex.trim().toLowerCase();
    if (!/^[0-9a-f]+$/.test(normalized) || normalized.length % 2 !== 0) {
        throw new Error('Invalid salt format from server');
    }
    const matches = normalized.match(/.{1,2}/g);
    if (!matches) {
        throw new Error('Invalid salt format from server');
    }
    return new Uint8Array(matches.map((byte) => parseInt(byte, 16)));
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    let mismatch = 0;
    for (let i = 0; i < a.length; i++) mismatch |= (a[i] ^ b[i]);
    return mismatch === 0;
}

function InputField({
    label, value, onChangeText, placeholder, secureTextEntry = false, icon, rightSlot,
}: {
    label: string;
    value: string;
    onChangeText: (v: string) => void;
    placeholder?: string;
    secureTextEntry?: boolean;
    icon?: string;
    rightSlot?: React.ReactNode;
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
                {rightSlot}
            </View>
        </View>
    );
}

export default function ChangePasswordScreen({ navigation }: any) {
    const { userId, email, masterKey, setMasterKey } = useAuthStore();
    const { entries, version, clearVault, getDeviceIdForSync } = useVaultStore();

    const [currentPassword, setCurrentPassword] = React.useState('');
    const [newPassword, setNewPassword] = React.useState('');
    const [confirmPassword, setConfirmPassword] = React.useState('');
    const [showPasswords, setShowPasswords] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [isPasswordValid, setIsPasswordValid] = React.useState(false);
    const abortControllerRef = React.useRef<AbortController | null>(null);

    // Cleanup on unmount
    React.useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    const canSubmit = useMemo(() => {
        return (
            currentPassword.trim().length > 0 &&
            isPasswordValid &&
            confirmPassword.trim().length >= 8 &&
            !isSubmitting
        );
    }, [currentPassword, isPasswordValid, confirmPassword, isSubmitting]);

    const handleSubmit = async () => {
        if (!userId || !email || !masterKey) {
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
        abortControllerRef.current = new AbortController();
        try {
            // Validate current password against the active session key.
            const saltResponse = await axios.get(`${API_URL}/auth/salt/${encodeURIComponent(email)}`, {
                signal: abortControllerRef.current.signal,
            });
            const serverSalt = hexToBytes(saltResponse.data.salt);
            const currentArgon2Memory = Number(saltResponse.data.argon2Memory || 128);
            const currentArgon2Iterations = Number(saltResponse.data.argon2Iterations || 1);
            const currentDerivedKey = await deriveKey(currentPassword, serverSalt, {
                memorySize: currentArgon2Memory,
                iterations: currentArgon2Iterations,
            });

            if (!equalBytes(currentDerivedKey.authKey, masterKey.authKey)) {
                Alert.alert('Invalid Password', 'Current master password is incorrect.');
                return;
            }

            const newSaltBuffer = crypto.getRandomValues(new Uint8Array(16));
            const newSaltHex = toHex(newSaltBuffer);
            // Explicitly use 128 KB memory and 1 iteration to match mobile registration
            const argon2Params = { memorySize: 128, iterations: 1 };
            const newDerivedKey = await deriveKey(newPassword, newSaltBuffer, argon2Params);
            const verifier = await generateVerifier(newDerivedKey.authKey);

            const serializedVault: VaultEntry = {
                url: '__vault__',
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
                    argon2Memory: argon2Params.memorySize,
                    argon2Iterations: argon2Params.iterations,
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
                    signal: abortControllerRef.current.signal,
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
            // Don't show error if request was aborted (component unmounted)
            if (error?.name === 'AbortError' || error?.name === 'CanceledError') {
                return;
            }
            const message = error?.response?.data?.message || error?.message || 'Failed to update password';
            Alert.alert('Update Failed', message);
        } finally {
            setIsSubmitting(false);
            abortControllerRef.current = null;
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
                        <Text style={styles.headerTitle}>Change Master Password</Text>
                        <View style={{ width: 44 }} />
                    </View>

                    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                        <View style={styles.card}>
                            <View style={styles.infoBox}>
                                <Ionicons name="shield-outline" size={20} color={Colors.primary} />
                                <Text style={styles.infoText}>
                                    This will re-encrypt your entire vault. Ensure you remember your new master password.
                                </Text>
                            </View>

                            <InputField
                                label="Current Password"
                                value={currentPassword}
                                onChangeText={setCurrentPassword}
                                placeholder="Enter current master password"
                                icon="lock-closed-outline"
                                secureTextEntry={!showPasswords}
                            />

                            <InputField
                                label="New Master Password"
                                value={newPassword}
                                onChangeText={setNewPassword}
                                placeholder="Min. 8 characters, mix of types"
                                icon="key-outline"
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
                                icon="checkmark-circle-outline"
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
                                style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
                                disabled={!canSubmit}
                                onPress={handleSubmit}
                            >
                                <LinearGradient
                                    colors={canSubmit ? [Colors.primary, '#EAB308'] : [Colors.border, Colors.border]}
                                    style={styles.submitGradient}
                                >
                                    {isSubmitting ? (
                                        <ActivityIndicator color={Colors.background} />
                                    ) : (
                                        <>
                                            <Ionicons name="shield-checkmark" size={18} color={Colors.background} style={{ marginRight: 8 }} />
                                            <Text style={styles.submitText}>Update & Re-encrypt</Text>
                                        </>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                            
                            <TouchableOpacity 
                                style={styles.cancelBtn} 
                                onPress={() => navigation.goBack()}
                                disabled={isSubmitting}
                            >
                                <Text style={styles.cancelText}>Cancel</Text>
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
    headerTitle: { ...Typography.heading, fontSize: 18, color: Colors.text },
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
    },
    infoText: {
        flex: 1,
        ...Typography.muted,
        fontSize: 12,
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
    cancelBtn: {
        alignItems: 'center',
        paddingVertical: 8,
    },
    cancelText: {
        ...Typography.muted,
        fontSize: 14,
    },
});
