import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { Colors, Spacing, Radius, Typography } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function HomeScreen() {
  const { logout, userId, fullName } = useAuthStore() as any;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={[Colors.background, '#080808', '#121212']}
        style={styles.gradient}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={styles.logoRing}>
              <Ionicons name="shield-checkmark" size={48} color={Colors.primary} />
            </View>
            <Text style={styles.welcome}>Welcome back,</Text>
            <Text style={styles.userName}>{fullName || 'Zenith User'}</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.cardIcon}>
              <Ionicons name="information-circle-outline" size={24} color={Colors.primary} />
            </View>
            <Text style={styles.cardTitle}>Vault Access</Text>
            <Text style={styles.cardText}>
              Your account is active. You can manage your credentials in the Vault tab or view your security summary on the Dashboard.
            </Text>
            
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>User ID:</Text>
              <Text style={styles.infoValue}>{userId?.slice(0, 16)}...</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
            <LinearGradient
              colors={[Colors.destructive, '#B91C1C']}
              style={styles.logoutGradient}
            >
              <Ionicons name="log-out-outline" size={20} color={Colors.text} style={{ marginRight: 8 }} />
              <Text style={styles.logoutText}>Secure Sign Out</Text>
            </LinearGradient>
          </TouchableOpacity>
          
          <Text style={styles.footerNote}>Zero-Knowledge Encryption Active</Text>
        </ScrollView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    padding: Spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoRing: {
    width: 100, height: 100,
    borderRadius: 50,
    backgroundColor: Colors.surface,
    borderWidth: 2, borderColor: Colors.primaryBorder,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 20,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  welcome: { ...Typography.muted, fontSize: 16 },
  userName: { ...Typography.heading, fontSize: 28, color: Colors.primary, marginTop: 4 },
  card: {
    backgroundColor: Colors.surface + '99',
    borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.lg,
    alignItems: 'center',
    width: '100%',
    marginBottom: 40,
  },
  cardIcon: {
    width: 48, height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primaryDim,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: { ...Typography.subheading, fontSize: 18, marginBottom: 8 },
  cardText: { ...Typography.muted, textAlign: 'center', lineHeight: 22, fontSize: 14, marginBottom: 20 },
  infoRow: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  infoLabel: { ...Typography.muted, fontSize: 11, fontWeight: '700' },
  infoValue: { ...Typography.mono, fontSize: 11, marginLeft: 6, color: Colors.textMuted },
  logoutBtn: {
    width: '100%',
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  logoutGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  logoutText: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  footerNote: { ...Typography.muted, fontSize: 12, marginTop: 24, opacity: 0.5 },
});
