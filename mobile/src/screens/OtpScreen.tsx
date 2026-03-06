import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity,
    ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native';
import axios from 'axios';
import { Colors, Spacing, Radius, Typography } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../config';
import { SecureStorageService } from '../services/secureStorage';
import { useAuthStore } from '../store/authStore';
import { LinearGradient } from 'expo-linear-gradient';

interface Props {
    email: string;
    onVerified: () => void;
}

export default function OtpScreen({ email, onVerified }: Props) {
    const { logout } = useAuthStore();
    const [code, setCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [countdown, setCountdown] = useState(0);

    // Auto-send OTP on mount
    useEffect(() => { sendOtp(); }, []);

    // Countdown timer for resend
    useEffect(() => {
        if (countdown <= 0) return;
        const t = setTimeout(() => setCountdown(c => c - 1), 1000);
        return () => clearTimeout(t);
    }, [countdown]);

    const getApiErrorMessage = (e: any, fallback: string) => {
        return (
            e?.response?.data?.message ||
            e?.response?.data?.error ||
            e?.message ||
            fallback
        );
    };

    const sendOtp = async () => {
        setIsSending(true);
        setError(null);
        try {
            const token = await SecureStorageService.getSessionId();
            if (!token) {
                throw new Error('Missing session token. Please login again.');
            }
            await axios.post(`${API_URL}/otp/send`, { email: email.trim().toLowerCase() }, {
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                timeout: 60000,
            });
            setCountdown(60);
        } catch (e: any) {
            const msg = e?.response?.status === 429
                ? 'Too many attempts. Please wait a minute.'
                : getApiErrorMessage(e, 'Failed to send OTP');
            setError(msg);
        } finally {
            setIsSending(false);
        }
    };

    const handleSignOut = async () => {
        try {
            await logout();
        } catch (e) {
            console.error('[OTP] Sign out failed', e);
        }
    };

    const verifyOtp = async () => {
        if (code.length !== 6) { setError('Please enter the 6-digit code'); return; }
        setIsLoading(true);
        setError(null);
        try {
            const token = await SecureStorageService.getSessionId();
            if (!token) {
                throw new Error('Missing session token. Please login again.');
            }
            await axios.post(`${API_URL}/otp/verify`, { email: email.trim().toLowerCase(), code }, {
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                timeout: 60000,
            });
            onVerified();
        } catch (e: any) {
            const msg = getApiErrorMessage(e, 'Invalid OTP code');
            setError(msg);
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
                    style={{ flex: 1, justifyContent: 'center' }}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    <View style={styles.inner}>
                        <View style={styles.iconContainer}>
                            <LinearGradient
                                colors={[Colors.primaryDim, 'rgba(234, 179, 8, 0.05)']}
                                style={styles.iconRing}
                            >
                                <Ionicons name="shield-checkmark" size={40} color={Colors.primary} />
                            </LinearGradient>
                        </View>

                        <Text style={styles.title}>Two-Factor Auth</Text>
                        <Text style={styles.subtitle}>
                            Protecting your vault. Enter the 6-digit code sent to{'\n'}
                            <Text style={{ color: Colors.primary, fontWeight: '700' }}>{email}</Text>
                        </Text>

                        {/* OTP Input */}
                        <View style={styles.inputContainer}>
                            <TextInput
                                style={styles.input}
                                value={code}
                                onChangeText={setCode}
                                placeholder="000000"
                                placeholderTextColor={Colors.textDim}
                                keyboardType="number-pad"
                                maxLength={6}
                                autoFocus
                            />
                        </View>

                        {error && (
                            <View style={styles.errorBox}>
                                <Ionicons name="alert-circle" size={14} color={Colors.destructive} />
                                <Text style={styles.errorText}>{error}</Text>
                            </View>
                        )}

                        <TouchableOpacity
                            style={[styles.btn, isLoading && styles.btnDisabled]}
                            onPress={verifyOtp}
                            disabled={isLoading}
                        >
                            <LinearGradient
                                colors={!isLoading ? [Colors.primary, '#EAB308'] : [Colors.border, Colors.border]}
                                style={styles.btnGradient}
                            >
                                {isLoading
                                    ? <ActivityIndicator color={Colors.background} />
                                    : (
                                        <>
                                            <Ionicons name="lock-open" size={18} color={Colors.background} style={{ marginRight: 8 }} />
                                            <Text style={styles.btnText}>Unlock Vault</Text>
                                        </>
                                    )}
                            </LinearGradient>
                        </TouchableOpacity>

                        <View style={styles.footerActions}>
                            <TouchableOpacity
                                style={styles.resendBtn}
                                onPress={sendOtp}
                                disabled={isSending || countdown > 0}
                            >
                                <Text style={[styles.resendText, countdown > 0 && styles.resendDisabled]}>
                                    {countdown > 0 ? `Resend in ${countdown}s` : 'Resend Code'}
                                </Text>
                            </TouchableOpacity>

                            <View style={styles.divider} />

                            <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
                                <Text style={styles.signOutText}>Sign Out</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.securitySeal}>
                            <Ionicons name="shield-half" size={16} color={Colors.textDim} />
                            <Text style={styles.securityText}>Zenith Zero-Knowledge Protection</Text>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    gradient: { flex: 1 },
    inner: { paddingHorizontal: Spacing.xl, alignItems: 'center' },
    iconContainer: {
        marginBottom: 24,
    },
    iconRing: {
        width: 100, height: 100, borderRadius: 50,
        justifyContent: 'center', alignItems: 'center',
        borderWidth: 2, borderColor: Colors.primaryBorder,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 8,
    },
    title: { ...Typography.heading, fontSize: 26, marginBottom: 8 },
    subtitle: { ...Typography.muted, fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
    inputContainer: {
        width: '100%',
        marginBottom: 16,
    },
    input: {
        backgroundColor: Colors.surface + '88',
        borderRadius: Radius.lg,
        borderWidth: 1, borderColor: Colors.border,
        fontSize: 28, letterSpacing: 8,
        paddingVertical: 16,
        textAlign: 'center',
        ...Typography.mono,
    },
    errorBox: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderRadius: Radius.md,
        paddingHorizontal: 12, paddingVertical: 8, marginBottom: 16,
        borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)',
    },
    errorText: { color: Colors.destructive, fontSize: 13, fontWeight: '500' },
    btn: {
        width: '100%',
        borderRadius: Radius.lg,
        overflow: 'hidden',
        marginBottom: 24,
    },
    btnGradient: {
        paddingVertical: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    btnDisabled: { opacity: 0.6 },
    btnText: { color: Colors.background, fontWeight: '700', fontSize: 16 },
    footerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        marginBottom: 40,
    },
    resendBtn: { padding: 8 },
    resendText: { color: Colors.primary, fontSize: 14, fontWeight: '700' },
    resendDisabled: { color: Colors.textDim },
    divider: { width: 1, height: 14, backgroundColor: Colors.border },
    signOutBtn: { padding: 8 },
    signOutText: { color: Colors.textMuted, fontSize: 14, fontWeight: '500' },
    securitySeal: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        opacity: 0.6,
    },
    securityText: { ...Typography.muted, fontSize: 11, letterSpacing: 0.5 },
});
