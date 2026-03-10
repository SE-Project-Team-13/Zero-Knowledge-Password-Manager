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
import { Buffer } from 'buffer';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../config';
import { Colors, Radius, Spacing, Typography } from '../theme';
import { SecureStorageService } from '../services/secureStorage';
import { useAuthStore } from '../store/authStore';
import { LinearGradient } from 'expo-linear-gradient';
import { decryptData } from '@password-manager/crypto-engine';

function parseHexBytes(hex: string, fieldName: string): Uint8Array {
    const chunks = hex.match(/.{1,2}/g);
    if (!chunks) throw new Error(`Invalid ${fieldName} format`);
    return new Uint8Array(chunks.map((byte) => parseInt(byte, 16)));
}

function InputField({
    label, value, onChangeText, placeholder, icon, multiline = false,
}: {
    label: string;
    value: string;
    onChangeText: (v: string) => void;
    placeholder?: string;
    icon?: string;
    multiline?: boolean;
}) {
    return (
        <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>{label}</Text>
            <View style={[styles.fieldRow, multiline && { alignItems: 'flex-start', minHeight: 100 }]}>
                {icon && <Ionicons name={icon as any} size={16} color={Colors.textMuted} style={{ marginRight: 8, marginTop: multiline ? 4 : 0 }} />}
                <TextInput
                    style={[styles.fieldInput, multiline && { textAlignVertical: 'top' }]}
                    value={value}
                    onChangeText={onChangeText}
                    placeholder={placeholder}
                    placeholderTextColor={Colors.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    multiline={multiline}
                />
            </View>
        </View>
    );
}

export default function RecoveryLoginScreen({ navigation }: any) {
    const [email, setEmail] = useState('');
    const [recoveryKey, setRecoveryKey] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { setRecoveryContext } = useAuthStore();

    const handleRecoveryLogin = async () => {
        setError(null);

        if (!email.trim() || !recoveryKey.trim()) {
            setError('Email and Recovery Key are required.');
            return;
        }

        setIsLoading(true);
        try {
            const normalizedEmail = email.trim().toLowerCase();
            const cleanRecoveryKey = recoveryKey.replace(/[\s-]/g, '').trim();
            
            // Validate base64 format
            if (!/^[A-Za-z0-9+/]+=*$/.test(cleanRecoveryKey)) {
                setError('Invalid recovery key format. Please check your Emergency Kit.');
                setIsLoading(false);
                return;
            }

            const response = await axios.post(`${API_URL}/recovery/login`, {
                email: normalizedEmail,
                recoveryKey: cleanRecoveryKey,
            });

            const data = response.data;
            const token = data?.sessionToken;
            const userId = data?.userId;
            const encryptedVaultKey = data?.encryptedVaultKey as string | undefined;

            if (!token || !userId) {
                throw new Error('Invalid recovery response.');
            }

            await SecureStorageService.saveSessionId(token);
            await SecureStorageService.saveItem('user_id', userId);

            let recoveredMasterPassword: string | null = null;
            if (encryptedVaultKey) {
                try {
                    const encryptedObj = JSON.parse(encryptedVaultKey);
                    
                    // The recovery key is base64 encoded
                    const keyBytes = new Uint8Array(Buffer.from(cleanRecoveryKey, 'base64'));
                    
                    // Decrypt using our platform-agnostic tool
                    const decryptedBuffer = await decryptData(encryptedObj.ciphertext, encryptedObj.iv, keyBytes);
                    recoveredMasterPassword = new TextDecoder().decode(decryptedBuffer);
                } catch (decryptError) {
                    console.warn('[Recovery] Key derivation failed:', decryptError);
                }
            }

            setRecoveryContext(normalizedEmail, recoveredMasterPassword);
            navigation.replace('ResetPassword');
        } catch (e: any) {
            const message = e?.response?.data?.message || e?.message || 'Recovery failed';
            setError(message);
        } finally {
            setIsLoading(false);
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
                            <View style={styles.iconRingContainer}>
                                <LinearGradient
                                    colors={['rgba(239, 68, 68, 0.1)', 'transparent']}
                                    style={styles.iconRing}
                                >
                                    <Ionicons name="medical" size={40} color={Colors.destructive} />
                                </LinearGradient>
                            </View>

                            <Text style={styles.title}>Emergency Access</Text>
                            <Text style={styles.subtitle}>
                                Use your Emergency Kit recovery key to regain access to your vault.
                            </Text>

                            <InputField
                                label="Email Address"
                                value={email}
                                onChangeText={setEmail}
                                placeholder="your@email.com"
                                icon="mail-outline"
                            />

                            <InputField
                                label="Recovery Key"
                                value={recoveryKey}
                                onChangeText={setRecoveryKey}
                                placeholder="Paste your 256-bit recovery key here"
                                icon="key-outline"
                                multiline
                            />

                            {error && (
                                <View style={styles.errorBox}>
                                    <Ionicons name="alert-circle" size={14} color={Colors.destructive} />
                                    <Text style={styles.errorText}>{error}</Text>
                                </View>
                            )}

                            <TouchableOpacity
                                style={[styles.submitBtn, isLoading && styles.submitBtnDisabled]}
                                disabled={isLoading}
                                onPress={handleRecoveryLogin}
                            >
                                <LinearGradient
                                    colors={!isLoading ? [Colors.primary, '#EAB308'] : [Colors.border, Colors.border]}
                                    style={styles.btnGradient}
                                >
                                    {isLoading ? (
                                        <ActivityIndicator color={Colors.background} />
                                    ) : (
                                        <>
                                            <Ionicons name="shield-checkmark" size={18} color={Colors.background} style={{ marginRight: 8 }} />
                                            <Text style={styles.submitText}>Initiate Recovery</Text>
                                        </>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                style={styles.cancelBtn} 
                                onPress={() => navigation.goBack()}
                                disabled={isLoading}
                            >
                                <Text style={styles.cancelText}>Back to Sign In</Text>
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
        alignItems: 'center',
    },
    iconRingContainer: {
        marginBottom: 8,
    },
    iconRing: {
        width: 80, height: 80, borderRadius: 40,
        justifyContent: 'center', alignItems: 'center',
        borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)',
    },
    title: { ...Typography.heading, fontSize: 22, textAlign: 'center' },
    subtitle: { ...Typography.muted, fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 8 },
    fieldContainer: { width: '100%', gap: 6 },
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
    errorBox: {
        width: '100%',
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderRadius: Radius.md,
        paddingHorizontal: 12, paddingVertical: 8,
        borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)',
    },
    errorText: { color: Colors.destructive, fontSize: 13, fontWeight: '500' },
    submitBtn: {
        width: '100%',
        borderRadius: Radius.md,
        overflow: 'hidden',
        marginTop: Spacing.sm,
    },
    submitBtnDisabled: { opacity: 0.5 },
    btnGradient: {
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
    cancelBtn: { paddingVertical: 8 },
    cancelText: { ...Typography.muted, fontSize: 14, fontWeight: '600', color: Colors.primary },
});
