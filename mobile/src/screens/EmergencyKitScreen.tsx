import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Clipboard,
    ScrollView,
} from 'react-native';
import { Colors, Spacing, Radius, Typography } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../store/authStore';
import { API_URL } from '../config';
import axios from 'axios';
import { SecureStorageService } from '../services/secureStorage';
import { encryptData, sha256Hash } from '@password-manager/crypto-engine';
import { Buffer } from 'buffer';

export default function EmergencyKitScreen() {
    const { email } = useAuthStore();
    const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [copied, setCopied] = useState(false);

    const generateKey = async () => {
        setIsGenerating(true);
        try {
            const token = await SecureStorageService.getSessionId();
            const masterPassword = await SecureStorageService.getItem('master_password'); // SecureStorageService should have this if we saved it during unlock

            if (!masterPassword) {
                Alert.alert('Session Error', 'Master password not found in secure session. Please unlock your vault again.');
                setIsGenerating(false);
                return;
            }

            // 1. Generate key from server
            const res = await axios.post(
                `${API_URL}/recovery/generate`,
                { email },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            const { recoveryKey: rawKey } = res.data;

            // 2. Encrypt master password with recovery key
            // Convert recovery key (base64) to bytes
            const keyBytes = new Uint8Array(Buffer.from(rawKey, 'base64'));
            
            // Encrypt using our platform-agnostic tool
            const { iv, ciphertext } = await encryptData(masterPassword, keyBytes);
            const encryptedVaultKey = JSON.stringify({ iv, ciphertext });

            // 3. Hash the key for activation (using SHA-256)
            const keyHash = sha256Hash(rawKey);

            // 4. Activate on server
            await axios.post(
                `${API_URL}/recovery/activate`,
                { email, keyHash, encryptedVaultKey },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setRecoveryKey(rawKey);
            Alert.alert('Success', 'Emergency Kit generated!');
        } catch (error: any) {
            console.error('[Emergency] Generation failed', error);
            Alert.alert('Error', error.response?.data?.error || error.message || 'Failed to generate kit');
        } finally {
            setIsGenerating(false);
        }
    };

    const copyToClipboard = () => {
        if (!recoveryKey) return;
        Clipboard.setString(recoveryKey);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <LinearGradient colors={[Colors.background, '#1A1A1A']} style={styles.container}>
            <View style={styles.header}>
                <Ionicons name="shield-checkmark-outline" size={32} color={Colors.primary} />
                <Text style={styles.title}>Emergency Kit</Text>
                <Text style={styles.subtitle}>Secure recovery key to regain access if you forget your master password.</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {!recoveryKey ? (
                    <View style={styles.setupCard}>
                        <View style={styles.infoRow}>
                            <Ionicons name="alert-circle-outline" size={24} color="#F59E0B" />
                            <Text style={styles.infoText}>Before you continue:</Text>
                        </View>
                        <Text style={styles.bullet}>• This will revoke any existing recovery keys</Text>
                        <Text style={styles.bullet}>• The key will only be shown ONCE</Text>
                        <Text style={styles.bullet}>• Store it in a secure PHYSICAL location</Text>

                        <TouchableOpacity 
                            style={styles.generateBtn} 
                            onPress={generateKey}
                            disabled={isGenerating}
                        >
                            {isGenerating ? (
                                <ActivityIndicator color={Colors.background} />
                            ) : (
                                <>
                                    <Ionicons name="key-outline" size={20} color={Colors.background} style={{ marginRight: 8 }} />
                                    <Text style={styles.generateBtnText}>Generate New Key</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.keyCard}>
                        <View style={styles.warningBox}>
                            <Ionicons name="warning-outline" size={20} color="#EF4444" />
                            <Text style={styles.warningText}>This is the ONLY time you'll see this!</Text>
                        </View>

                        <View style={styles.keyBox}>
                            <Text style={styles.keyLabel}>YOUR RECOVERY KEY</Text>
                            <View style={styles.keyDisplay}>
                                <Text style={styles.keyText}>{recoveryKey}</Text>
                            </View>
                        </View>

                        <TouchableOpacity style={styles.copyBtn} onPress={copyToClipboard}>
                            <Ionicons name={copied ? "checkmark" : "copy-outline"} size={20} color={Colors.primary} />
                            <Text style={styles.copyBtnText}>{copied ? "Copied to Clipboard" : "Copy Recovery Key"}</Text>
                        </TouchableOpacity>

                        <Text style={styles.footerNote}>
                            Write this key down and keep it in a safe place. We cannot recover it for you.
                        </Text>
                    </View>
                )}
            </ScrollView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        paddingTop: 60,
        paddingHorizontal: Spacing.xl,
        alignItems: 'center',
        marginBottom: Spacing.xl,
    },
    title: { ...Typography.heading, color: Colors.primary, marginTop: 12 },
    subtitle: { ...Typography.muted, textAlign: 'center', marginTop: 8, fontSize: 13 },
    content: { paddingHorizontal: Spacing.lg, paddingBottom: 40 },
    setupCard: {
        backgroundColor: Colors.surface,
        borderRadius: Radius.lg,
        padding: Spacing.xl,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    infoText: { color: '#F59E0B', fontWeight: '700', marginLeft: 8 },
    bullet: { ...Typography.body, color: Colors.textMuted, marginBottom: 8, fontSize: 14 },
    generateBtn: {
        backgroundColor: Colors.primary,
        height: 52,
        borderRadius: Radius.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 24,
    },
    generateBtnText: { color: Colors.background, fontWeight: 'bold', fontSize: 16 },
    keyCard: {
        backgroundColor: Colors.surface,
        borderRadius: Radius.lg,
        padding: Spacing.xl,
        borderWidth: 1,
        borderColor: Colors.primary + '40',
    },
    warningBox: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderRadius: Radius.md,
        marginBottom: 20,
    },
    warningText: { color: '#EF4444', fontWeight: '700', marginLeft: 8, fontSize: 12 },
    keyBox: { marginBottom: 20 },
    keyLabel: { ...Typography.muted, fontSize: 11, marginBottom: 8, fontWeight: '700' },
    keyDisplay: {
        backgroundColor: Colors.background,
        padding: 20,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    keyText: { ...Typography.mono, color: Colors.text, fontSize: 15, textAlign: 'center' },
    copyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.primary,
    },
    copyBtnText: { color: Colors.primary, fontWeight: '700', marginLeft: 8 },
    footerNote: { ...Typography.muted, textAlign: 'center', marginTop: 20, fontSize: 12 },
});
