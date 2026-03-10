import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, StatusBar, KeyboardAvoidingView, Platform, Image, ScrollView } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView as SafeAreaContext } from 'react-native-safe-area-context';
import { Colors, Radius, Spacing, Typography } from '../theme';

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading, error } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Input Required", "Please enter your email and master password.");
      return;
    }
    await login(email, password);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={[Colors.background, '#080808', '#121212']}
        style={styles.gradient}
      >
        <SafeAreaContext style={styles.safeArea}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardView}
          >
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              <View style={styles.content}>
                {/* Header / Logo Area */}
                <View style={styles.header}>
                  <View style={styles.iconContainer}>
                    <Image
                      source={require('../../assets/logo.png')}
                      style={styles.logoImage}
                      resizeMode="cover"
                    />
                  </View>
                  <Text style={styles.title}>Zenith <Text style={{ color: Colors.primary }}>Vault</Text></Text>
                  <Text style={styles.subtitle}>
                    Unlock your secure vault
                  </Text>
                </View>

                {/* Input Area */}
                <View style={styles.form}>
                  {/* Email Input */}
                  <View style={styles.inputContainer}>
                    <Ionicons name="mail-outline" size={20} color={Colors.textMuted} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Email Address"
                      placeholderTextColor={Colors.textDim}
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                    />
                  </View>

                  {/* Password Input */}
                  <View style={styles.inputContainer}>
                    <Ionicons name="key-outline" size={20} color={Colors.textMuted} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Master Password"
                      placeholderTextColor={Colors.textDim}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                      <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={Colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Error Message */}
                {error && (
                  <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle" size={18} color={Colors.destructive} />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                {/* Action Button */}
                <TouchableOpacity
                  style={styles.button}
                  onPress={handleLogin}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color={Colors.background} />
                  ) : (
                    <Text style={styles.buttonText}>Access Vault</Text>
                  )}
                </TouchableOpacity>

                {/* Recovery Link */}
                <TouchableOpacity style={styles.switchButton} onPress={() => navigation.navigate('RecoveryLogin')}>
                  <Text style={[styles.switchText, { color: Colors.textMuted, fontSize: 14 }]}>Forgot Password? Use Recovery Key</Text>
                </TouchableOpacity>

                <View style={styles.registerNote}>
                  <Ionicons name="information-circle-outline" size={16} color={Colors.textMuted} />
                  <Text style={styles.registerNoteText}>
                    New users must register on web/desktop to create an account and emergency kit.
                  </Text>
                </View>

                {/* Footer Badges */}
                <View style={styles.footerInfo}>
                    <View style={styles.badgeRow}>
                        <View style={styles.badge}>
                            <Ionicons name="shield-checkmark" size={12} color={Colors.success} />
                            <Text style={styles.badgeText}>AES-256</Text>
                        </View>
                        <View style={styles.badge}>
                            <Ionicons name="lock-closed" size={12} color={Colors.primary} />
                            <Text style={styles.badgeText}>Argon2id</Text>
                        </View>
                        <View style={styles.badge}>
                            <Ionicons name="key" size={12} color={Colors.primary} />
                            <Text style={styles.badgeText}>Zero-Knowledge</Text>
                        </View>
                    </View>
                    <Text style={styles.copyright}>© 2026 Zenith Vault</Text>
                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaContext>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: {
    padding: Spacing.xl,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconContainer: {
    width: 90,
    height: 90,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoImage: {
    width: 90,
    height: 90,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
  },
  title: {
    ...Typography.heading,
    fontSize: 36,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  subtitle: {
    ...Typography.muted,
    fontSize: 15,
    textAlign: 'center',
  },
  form: {
    marginBottom: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    ...Typography.body,
    flex: 1,
    fontSize: 16,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  buttonText: {
    color: Colors.background,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  switchButton: {
    alignItems: 'center',
    padding: 8,
  },
  switchText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  registerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    paddingHorizontal: 20,
    gap: 8,
  },
  registerNoteText: {
    ...Typography.muted,
    fontSize: 12,
    textAlign: 'center',
    flex: 1,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.destructive + '15',
    padding: 12,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.destructive + '40',
    marginBottom: 24,
  },
  errorText: {
    color: Colors.destructive,
    marginLeft: 8,
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  footerInfo: {
    alignItems: 'center',
    marginTop: 40,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badgeText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  copyright: {
    fontSize: 10,
    color: Colors.textDim,
  }
});
