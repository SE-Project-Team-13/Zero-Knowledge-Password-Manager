import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, StatusBar, KeyboardAvoidingView, Platform, Image } from 'react-native';
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

  const [strength, setStrength] = useState(0);
  const [criteria, setCriteria] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false
  });

  const checkStrength = (pass: string) => {
    if (!pass || !isRegistering) {
      setStrength(0);
      setCriteria({
        length: false,
        uppercase: false,
        lowercase: false,
        number: false,
        special: false
      });
      return;
    }

    const newCriteria = {
      length: pass.length >= 8,
      uppercase: /[A-Z]/.test(pass),
      lowercase: /[a-z]/.test(pass),
      number: /[0-9]/.test(pass),
      special: /[^A-Za-z0-9]/.test(pass)
    };

    setCriteria(newCriteria);
    const satisfied = Object.values(newCriteria).filter(Boolean).length;
    setStrength(satisfied / 5);
  };

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

      const satisfiedCount = Object.values(criteria).filter(Boolean).length;
      if (satisfiedCount < 5) {
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
          " This will generate a new master key. Ensure you remember this password!",
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
    } else {
      await login(email, password);
    }
  };

  const toggleMode = () => {
    setIsRegistering(!isRegistering);
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setStrength(0);
    setCriteria({
      length: false,
      uppercase: false,
      lowercase: false,
      number: false,
      special: false
    });
  };

  const getStrengthColor = (s: number) => {
    if (s <= 0.2) return Colors.destructive;
    if (s <= 0.4) return '#F97316'; // orange-500
    if (s <= 0.6) return '#FACC15'; // yellow-400
    if (s <= 0.8) return '#3B82F6'; // blue-500
    return Colors.success;
  };

  const getStrengthLabel = (s: number) => {
    if (s <= 0.2) return 'Very Weak';
    if (s <= 0.4) return 'Weak';
    if (s <= 0.6) return 'Medium';
    if (s <= 0.8) return 'Strong';
    return 'Very Strong';
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
                  <Image
                    source={require('../../assets/logo.png')}
                    style={styles.logoImage}
                    resizeMode="cover"
                  />
                </View>
                <Text style={styles.title}>Zenith Vault</Text>
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
                    onChangeText={(val) => {
                      setPassword(val);
                      checkStrength(val);
                    }}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={Colors.textMuted} />
                  </TouchableOpacity>
                </View>

                {/* Password Strength Indicator (Register Only) */}
                {isRegistering && (
                  <View style={styles.strengthContainer}>
                    <View style={styles.strengthHeader}>
                      <Text style={styles.strengthLabel}>Password Strength</Text>
                      <Text style={[styles.strengthLevel, { color: getStrengthColor(strength) }]}>
                        {getStrengthLabel(strength)}
                      </Text>
                    </View>
                    <View style={styles.progressBarBackground}>
                      <View style={[styles.progressBarForeground, { width: `${strength * 100}%`, backgroundColor: getStrengthColor(strength) }]} />
                    </View>

                    <View style={styles.criteriaGrid}>
                      <View style={styles.criteriaItem}>
                        <Ionicons
                          name={criteria.length ? "checkmark-circle" : "ellipse-outline"}
                          size={14}
                          color={criteria.length ? Colors.success : Colors.textMuted}
                        />
                        <Text style={[styles.criteriaText, criteria.length && styles.criteriaActive]}>8+ Chars</Text>
                      </View>
                      <View style={styles.criteriaItem}>
                        <Ionicons
                          name={criteria.uppercase ? "checkmark-circle" : "ellipse-outline"}
                          size={14}
                          color={criteria.uppercase ? Colors.success : Colors.textMuted}
                        />
                        <Text style={[styles.criteriaText, criteria.uppercase && styles.criteriaActive]}>Uppercase</Text>
                      </View>
                      <View style={styles.criteriaItem}>
                        <Ionicons
                          name={criteria.lowercase ? "checkmark-circle" : "ellipse-outline"}
                          size={14}
                          color={criteria.lowercase ? Colors.success : Colors.textMuted}
                        />
                        <Text style={[styles.criteriaText, criteria.lowercase && styles.criteriaActive]}>Lowercase</Text>
                      </View>
                      <View style={styles.criteriaItem}>
                        <Ionicons
                          name={criteria.number ? "checkmark-circle" : "ellipse-outline"}
                          size={14}
                          color={criteria.number ? Colors.success : Colors.textMuted}
                        />
                        <Text style={[styles.criteriaText, criteria.number && styles.criteriaActive]}>Number</Text>
                      </View>
                      <View style={styles.criteriaItem}>
                        <Ionicons
                          name={criteria.special ? "checkmark-circle" : "ellipse-outline"}
                          size={14}
                          color={criteria.special ? Colors.success : Colors.textMuted}
                        />
                        <Text style={[styles.criteriaText, criteria.special && styles.criteriaActive]}>Special Char</Text>
                      </View>
                    </View>
                  </View>
                )}

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
                style={[styles.button, (isRegistering && Object.values(criteria).filter(Boolean).length < 5) && styles.buttonDisabled]}
                onPress={handleAction}
                disabled={isLoading || (isRegistering && Object.values(criteria).filter(Boolean).length < 5)}
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
                  {isRegistering ? "Already have an account? Sign In" : "New to Zenith Vault? Create Account"}
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
  buttonDisabled: {
    backgroundColor: '#3f3f3f',
    shadowOpacity: 0,
    elevation: 0,
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
  strengthContainer: {
    marginBottom: 20,
    backgroundColor: Colors.surfaceElevated,
    padding: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  strengthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  strengthLabel: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  strengthLevel: {
    fontSize: 13,
    fontWeight: '700',
  },
  progressBarBackground: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: Radius.full,
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressBarForeground: {
    height: '100%',
    borderRadius: Radius.full,
  },
  criteriaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  criteriaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 4,
    marginBottom: 2,
  },
  criteriaText: {
    fontSize: 12,
    color: Colors.textDim,
    marginLeft: 4,
  },
  criteriaActive: {
    color: Colors.text,
    fontWeight: '500',
  },
});
