import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, StatusBar, KeyboardAvoidingView, Platform, Image, ScrollView } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView as SafeAreaContext } from 'react-native-safe-area-context';
import { Colors, Radius, Spacing, Typography } from '../theme';
import PasswordStrength from '../components/PasswordStrength';

export default function RegisterScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const { register, isLoading, error } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [isPasswordValid, setIsPasswordValid] = useState(false);

  const handleRegister = async () => {
    if (!email || !password || !fullName || !confirmPassword) {
      Alert.alert("Input Required", "Please fill in all fields.");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Password Mismatch", "Passwords do not match.");
      return;
    }

    if (!isPasswordValid) {
      Alert.alert(
        "Weak Password",
        "Please meet all security requirements: 8+ chars, uppercase, lowercase, number, and special character."
      );
      return;
    }

    if (Platform.OS === 'web') {
      const confirmResult = window.confirm("Create New Vault?\nThis will generate a new master key. Ensure you remember this password!");
      if (confirmResult) {
        await register(email, fullName, password);
      }
    } else {
      Alert.alert(
        "Create New Vault?",
        "This will generate a new master key. Ensure you remember this password!",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Create",
            onPress: async () => {
              await register(email, fullName, password);
            }
          }
        ]
      );
    }
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
                    Start securing your passwords with zero-knowledge encryption
                  </Text>
                </View>

                {/* Input Area */}
                <View style={styles.form}>
                  {/* Full Name Input */}
                  <View style={styles.inputContainer}>
                    <Ionicons name="person-outline" size={20} color={Colors.textMuted} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Full Name"
                      placeholderTextColor={Colors.textDim}
                      value={fullName}
                      onChangeText={setFullName}
                    />
                  </View>

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

                  <PasswordStrength 
                    password={password} 
                    onStrengthChange={setIsPasswordValid} 
                  />

                  {/* Confirm Password Input */}
                  <View style={styles.inputContainer}>
                    <Ionicons name="checkmark-circle-outline" size={20} color={Colors.textMuted} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Confirm Password"
                      placeholderTextColor={Colors.textDim}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!showPassword}
                    />
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
                  style={[styles.button, !isPasswordValid && styles.buttonDisabled]}
                  onPress={handleRegister}
                  disabled={isLoading || !isPasswordValid}
                >
                  {isLoading ? (
                    <ActivityIndicator color={Colors.background} />
                  ) : (
                    <Text style={styles.buttonText}>Create Account</Text>
                  )}
                </TouchableOpacity>

                {/* Toggle Mode */}
                <TouchableOpacity
                  style={styles.switchButton}
                  onPress={() => navigation.navigate('Login')}
                >
                  <Text style={styles.switchText}>
                    Already have an account? Sign In
                  </Text>
                </TouchableOpacity>

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
    paddingTop: Spacing.lg,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoImage: {
    width: 80,
    height: 80,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
  },
  title: {
    ...Typography.heading,
    fontSize: 32,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  subtitle: {
    ...Typography.muted,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  form: {
    marginBottom: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    height: 52,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    ...Typography.body,
    flex: 1,
    fontSize: 15,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  buttonDisabled: {
    backgroundColor: '#3f3f3f',
    shadowOpacity: 0,
    elevation: 0,
    opacity: 0.6,
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
    marginBottom: 32,
  },
  switchText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
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
    marginBottom: 20,
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
    marginTop: 20,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badgeText: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  copyright: {
    fontSize: 10,
    color: Colors.textDim,
  }
});
