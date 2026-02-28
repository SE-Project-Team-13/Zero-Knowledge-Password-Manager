import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, SafeAreaView, StatusBar, KeyboardAvoidingView, Platform } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView as SafeAreaContext } from 'react-native-safe-area-context';

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

      // Registration Logic
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
      // Login Logic
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
        colors={['#0F172A', '#1E293B', '#334155']}
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
                  <Ionicons name="shield-checkmark" size={60} color="#38BDF8" />
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
                    <Ionicons name="person-outline" size={24} color="#94A3B8" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Full Name"
                      placeholderTextColor="#64748B"
                      value={fullName}
                      onChangeText={setFullName}
                    />
                  </View>
                )}

                {/* Email Input */}
                <View style={styles.inputContainer}>
                  <Ionicons name="mail-outline" size={24} color="#94A3B8" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Email Address"
                    placeholderTextColor="#64748B"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>

                {/* Password Input */}
                <View style={styles.inputContainer}>
                  <Ionicons name="key-outline" size={24} color="#94A3B8" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Master Password"
                    placeholderTextColor="#64748B"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={24} color="#94A3B8" />
                  </TouchableOpacity>
                </View>

                {/* Confirm Password Input (Register Only) */}
                {isRegistering && (
                  <View style={styles.inputContainer}>
                    <Ionicons name="checkmark-circle-outline" size={24} color="#94A3B8" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Confirm Password"
                      placeholderTextColor="#64748B"
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
                  <Ionicons name="alert-circle" size={20} color="#EF4444" />
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
                  <ActivityIndicator color="#0F172A" />
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
                  <Text style={styles.switchText}>Forgot Password? Use Recovery Key</Text>
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
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconContainer: {
    width: 100,
    height: 100,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.2)',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
  },
  form: {
    marginBottom: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#38BDF8',
    borderRadius: 12,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  buttonText: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '700',
  },
  switchButton: {
    alignItems: 'center',
    padding: 8,
  },
  switchText: {
    color: '#38BDF8',
    fontSize: 14,
    fontWeight: '600',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    marginBottom: 24,
  },
  errorText: {
    color: '#EF4444',
    marginLeft: 8,
    flex: 1,
    fontSize: 14,
  },
});
