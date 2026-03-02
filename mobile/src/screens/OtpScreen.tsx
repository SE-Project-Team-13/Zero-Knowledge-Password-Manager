import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, TextInput, TouchableOpacity,
    ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import axios from 'axios';
import { Colors, Spacing, Radius, Typography } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../config';
import { SecureStorageService } from '../services/secureStorage';
import { useAuthStore } from '../store/authStore';

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
            console.log('[OTP] Sending OTP', { apiUrl: API_URL, email: email.trim().toLowerCase() });
            const response = await axios.post(`${API_URL}/otp/send`, { email: email.trim().toLowerCase() }, {
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                timeout: 60000,
            });
            console.log('[OTP] Send response', response.status, response.data);
            setCountdown(60);
        } catch (e: any) {
            console.error('[OTP] Send failed', {
                status: e?.response?.status,
                data: e?.response?.data,
                message: e?.message,
            });
            const msg = e?.response?.status === 429
                ? 'Too many OTP attempts. Please wait a minute and try again.'
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
        if (code.length < 4) { setError('Please enter the full code'); return; }
        setIsLoading(true);
        setError(null);
        try {
            const token = await SecureStorageService.getSessionId();
            if (!token) {
                throw new Error('Missing session token. Please login again.');
            }
            const response = await axios.post(`${API_URL}/otp/verify`, { email: email.trim().toLowerCase(), code }, {
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                timeout: 60000,
            });
            console.log('[OTP] Verify response', response.status, response.data);
            onVerified();
        } catch (e: any) {
            console.error('[OTP] Verify failed', {
                status: e?.response?.status,
                data: e?.response?.data,
                message: e?.message,
            });
            const msg = getApiErrorMessage(e, 'Invalid OTP code');
            setError(msg);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <View style={styles.inner}>
                {/* Icon */}
                <View style={styles.iconRing}>
                    <Ionicons name="mail" size={36} color={Colors.primary} />
                </View>

                <Text style={styles.title}>Verify Your Identity</Text>
                <Text style={styles.subtitle}>
                    A 6-digit code was sent to{'\n'}
                    <Text style={{ color: Colors.primary }}>{email}</Text>
                </Text>

                {/* OTP Input */}
                <TextInput
                    style={styles.input}
                    value={code}
                    onChangeText={setCode}
                    placeholder="Enter verification code"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="number-pad"
                    maxLength={8}
                    autoFocus
                />

                {error && (
                    <View style={styles.errorBox}>
                        <Ionicons name="alert-circle" size={14} color={Colors.destructive} />
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                )}

                {/* Verify Button */}
                <TouchableOpacity
                    style={[styles.btn, isLoading && styles.btnDisabled]}
                    onPress={verifyOtp}
                    disabled={isLoading}
                >
                    {isLoading
                        ? <ActivityIndicator color={Colors.background} />
                        : <Text style={styles.btnText}>Verify Code</Text>}
                </TouchableOpacity>

                {/* Resend */}
                <TouchableOpacity
                    style={styles.resendBtn}
                    onPress={sendOtp}
                    disabled={isSending || countdown > 0}
                >
                    {isSending
                        ? <ActivityIndicator size="small" color={Colors.primary} />
                        : <Text style={[styles.resendText, countdown > 0 && styles.resendDisabled]}>
                            {countdown > 0 ? `Resend in ${countdown}s` : 'Resend Code'}
                        </Text>}
                </TouchableOpacity>

                <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
                    <Ionicons name="log-out-outline" size={14} color={Colors.textMuted} />
                    <Text style={styles.signOutText}>Sign Out</Text>
                </TouchableOpacity>

                {/* Security note */}
                <View style={styles.note}>
                    <Ionicons name="shield-checkmark" size={12} color={Colors.success} />
                    <Text style={styles.noteText}>2FA protects your vault from unauthorized access</Text>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center' },
    inner: { paddingHorizontal: Spacing.lg, alignItems: 'center' },
    iconRing: {
        width: 80, height: 80, borderRadius: 40,
        backgroundColor: Colors.primaryDim, borderWidth: 2, borderColor: Colors.primaryBorder,
        justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.lg,
    },
    title: { ...Typography.heading, fontSize: 24, marginBottom: Spacing.sm },
    subtitle: { ...Typography.muted, fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: Spacing.xl },
    input: {
        width: '100%', backgroundColor: Colors.surface,
        borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border,
        color: Colors.text, fontSize: 20, letterSpacing: 4,
        padding: Spacing.md, textAlign: 'center', marginBottom: Spacing.sm,
    },
    errorBox: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: Colors.destructiveDim, borderRadius: Radius.sm,
        paddingHorizontal: Spacing.sm, paddingVertical: 6, marginBottom: Spacing.sm,
    },
    errorText: { color: Colors.destructive, fontSize: 13 },
    btn: {
        width: '100%', backgroundColor: Colors.primary,
        borderRadius: Radius.lg, padding: Spacing.md,
        alignItems: 'center', marginBottom: Spacing.sm,
    },
    btnDisabled: { opacity: 0.6 },
    btnText: { color: Colors.background, fontWeight: '700', fontSize: 16 },
    resendBtn: { padding: Spacing.sm, marginBottom: Spacing.lg },
    resendText: { color: Colors.primary, fontSize: 14, fontWeight: '600' },
    resendDisabled: { color: Colors.textMuted },
    signOutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: Spacing.lg,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
    },
    signOutText: { color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
    note: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: Colors.surface, borderRadius: Radius.full,
        paddingHorizontal: Spacing.md, paddingVertical: 8,
        borderWidth: 1, borderColor: Colors.border,
    },
    noteText: { ...Typography.muted, fontSize: 12 },
});
