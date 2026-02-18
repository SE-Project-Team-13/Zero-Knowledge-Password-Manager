import React from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';
import { useAuthStore } from '../store/authStore';

export default function HomeScreen() {
  const { logout, userId } = useAuthStore();

  return (
    <View style={styles.container}>
      <Text style={styles.welcome}>Welcome Back!</Text>
      <Text style={styles.userId}>User ID: {userId}</Text>
      <Text style={styles.info}>Vault features are currently disabled.</Text>
      <Button title="Logout" onPress={logout} color="#EF4444" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F3F4F6',
  },
  welcome: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#1F2937',
  },
  userId: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 20,
  },
  info: {
    fontSize: 16,
    color: '#4B5563',
    marginBottom: 40,
    textAlign: 'center',
  },
});
