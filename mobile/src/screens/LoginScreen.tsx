import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, StatusBar, KeyboardAvoidingView, Platform } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView as SafeAreaContext } from 'react-native-safe-area-context';
import { Colors, Radius, Spacing, Typography } from '../theme';

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const { login, register, isLoading, error } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);

  const handleAction = async () => {
    if (!email || !password) {
      Alert.alert("Input Required", "Please enter your email and master password.");
      return;
    }
    
    if (isRegistering) {
        if (!fullName) {
            Alert.alert("Input Required", "Please enter your full name.");
            return;
        }
        if (password !== confirmPassword) {
            Alert.alert("Password Mismatch", "Passwords do not match.");
            return;
        }
        if (password.length < 8) {
            Alert.alert("Weak Password", "Password must be at least 8 characters.");
            return;
        }

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
    } else {
      await login(email, password);
    }
  };

  const toggleMode = () => {
      setIsRegistering(!isRegistering);
      setPassword('');
      setConfirmPassword('');
      setShowPassword(false);
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
            <View style={styles.content}>
              {/* Header / Logo Area */}
              <View style={styles.header}>
                <View style={styles.iconContainer}>
                  <Ionicons name="shield-checkmark" size={60} color={Colors.primary} />
                </View>
                <Text style={styles.title}>ZeroPass</Text>
                <Text style={styles.subtitle}>
                  {isRegistering ? "Create your secure vault" : "Unlock your secure vault"}
                </Text>
              </View>

              {/* Input Area */}
              <View style={styles.form}>
                
                {/* Full Name Input (Register Only) */}
                {isRegistering && (
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
                )}

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

                {/* Confirm Password Input (Register Only) */}
                {isRegistering && (
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
                )}
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
                onPress={handleAction}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color={Colors.background} />
                ) : (
                  <Text style={styles.buttonText}>
                    {isRegistering ? "Create Account" : "Access Vault"}
                  </Text>
                )}
              </TouchableOpacity>

              {/* Toggle Mode */}
              <TouchableOpacity 
                style={styles.switchButton} 
                onPress={toggleMode}
              >
                <Text style={styles.switchText}>
                  {isRegistering ? "Already have an account? Sign In" : "New to ZeroPass? Create Account"}
                </Text>
              </TouchableOpacity>

              {!isRegistering && (
                <TouchableOpacity style={styles.switchButton} onPress={() => navigation.navigate('RecoveryLogin')}>
                  <Text style={[styles.switchText, { color: Colors.textMuted, fontSize: 13 }]}>Forgot Password? Use Recovery Key</Text>
                </TouchableOpacity>
              )}
            </View>
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
    backgroundColor: Colors.primaryDim,
    borderRadius: Radius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
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
    color: Colors.text,
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
});
