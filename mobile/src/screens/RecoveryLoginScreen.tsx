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
import { Buffer } from 'buffer';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../config';
import { Colors, Radius, Spacing, Typography } from '../theme';
import { SecureStorageService } from '../services/secureStorage';
import { useAuthStore } from '../store/authStore';

function parseHexBytes(hex: string, fieldName: string): Uint8Array {
    const chunks = hex.match(/.{1,2}/g);
    if (!chunks) throw new Error(`Invalid ${fieldName} format`);
    return new Uint8Array(chunks.map((byte) => parseInt(byte, 16)));
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
            setError('Please enter email and recovery key.');
            return;
        }

        setIsLoading(true);
        try {
            const normalizedEmail = email.trim().toLowerCase();
            const cleanRecoveryKey = recoveryKey.replace(/[\s-]/g, '').trim();

            const response = await axios.post(`${API_URL}/recovery/login`, {
                email: normalizedEmail,
                recoveryKey: cleanRecoveryKey,
            });

            const data = response.data;
            const token = data?.sessionToken;
            const userId = data?.userId;
            const encryptedVaultKey = data?.encryptedVaultKey as string | undefined;

            if (!token || !userId) {
                throw new Error('Invalid recovery login response from server.');
            }

            await SecureStorageService.saveSessionId(token);
            await SecureStorageService.saveItem('user_id', userId);

            let recoveredMasterPassword: string | null = null;
            if (encryptedVaultKey) {
                try {
                    const encryptedObj = JSON.parse(encryptedVaultKey);
                    const iv = parseHexBytes(encryptedObj.iv, 'iv');
                    const ciphertext = parseHexBytes(encryptedObj.ciphertext, 'ciphertext');

                    const keyBytes = new Uint8Array(Buffer.from(cleanRecoveryKey, 'base64'));
                    const wrappingKey = await crypto.subtle.importKey(
                        'raw',
                        keyBytes as any,
                        { name: 'AES-GCM' },
                        false,
                        ['decrypt'],
                    );

                    const decryptedBuffer = await crypto.subtle.decrypt(
                        { name: 'AES-GCM', iv: iv as any },
                        wrappingKey,
                        ciphertext as any,
                    );

                    recoveredMasterPassword = new TextDecoder().decode(decryptedBuffer);
                } catch (decryptError) {
                    console.warn('[Recovery] Could not decrypt encrypted vault key:', decryptError);
                }
            }

            setRecoveryContext(normalizedEmail, recoveredMasterPassword);
            navigation.replace('ResetPassword');
        } catch (e: any) {
            const message = e?.response?.data?.message || e?.response?.data?.error || e?.message || 'Recovery login failed';
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Recovery Login</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.content}>
                <Text style={styles.helperText}>Use your Emergency Kit recovery key to regain account access.</Text>

                <View style={styles.inputBlock}>
                    <Text style={styles.label}>Email</Text>
                    <TextInput
                        style={styles.input}
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        placeholder="your@email.com"
                        placeholderTextColor={Colors.textMuted}
                    />
                </View>

                <View style={styles.inputBlock}>
                    <Text style={styles.label}>Recovery Key</Text>
                    <TextInput
                        style={[styles.input, styles.monoInput]}
                        value={recoveryKey}
                        onChangeText={setRecoveryKey}
                        autoCapitalize="none"
                        placeholder="Paste recovery key"
                        placeholderTextColor={Colors.textMuted}
                        multiline
                    />
                </View>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                <TouchableOpacity style={[styles.submitBtn, isLoading && { opacity: 0.7 }]} onPress={handleRecoveryLogin} disabled={isLoading}>
                    {isLoading ? <ActivityIndicator color={Colors.background} /> : <Text style={styles.submitText}>Recover Account</Text>}
                </TouchableOpacity>

                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.linkBtn}>
                    <Text style={styles.linkText}>Back to Sign In</Text>
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
    monoInput: { fontFamily: 'Courier New' },
    errorText: { color: Colors.destructive, fontSize: 13 },
    submitBtn: {
        marginTop: Spacing.sm,
        backgroundColor: Colors.primary,
        borderRadius: Radius.md,
        paddingVertical: 14,
        alignItems: 'center',
    },
    submitText: { color: Colors.background, fontSize: 15, fontWeight: '700' },
    linkBtn: { alignItems: 'center', paddingVertical: 8 },
    linkText: { color: Colors.primary, fontSize: 13, fontWeight: '600' },
});
