import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, View, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAuthStore } from './src/store/authStore';
import { Colors } from './src/theme';

// Screens
import {
  LoginScreen,
  OtpScreen,
  DashboardScreen,
  VaultListScreen,
  AddCredentialScreen,
  SettingsScreen,
} from './src/screens';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function AuthenticatedTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          paddingBottom: 4,
          height: 60,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ focused, color, size }) => {
          const icons: Record<string, { active: string; inactive: string }> = {
            Dashboard: { active: 'home', inactive: 'home-outline' },
            Vault: { active: 'lock-closed', inactive: 'lock-closed-outline' },
            Settings: { active: 'settings', inactive: 'settings-outline' },
          };
          const iconSet = icons[route.name] || { active: 'apps', inactive: 'apps-outline' };
          return <Ionicons name={(focused ? iconSet.active : iconSet.inactive) as any} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Vault" component={VaultListScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

function AppAuthenticated() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={AuthenticatedTabs} />
      <Stack.Screen
        name="AddCredential"
        component={AddCredentialScreen}
        options={{ presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
}

function AppUnauthenticated() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
    </Stack.Navigator>
  );
}

export default function App() {
  const { isAuthenticated, isOtpPending, pendingEmail, completeOtpVerification, checkAuth } = useAuthStore();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    checkAuth().finally(() => setIsReady(true));
  }, []);

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
        <Ionicons name="shield-checkmark" size={48} color={Colors.primary} />
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 16 }} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      {isAuthenticated ? (
        <AppAuthenticated />
      ) : isOtpPending && pendingEmail ? (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Otp">
            {() => <OtpScreen email={pendingEmail} onVerified={completeOtpVerification} />}
          </Stack.Screen>
        </Stack.Navigator>
      ) : (
        <AppUnauthenticated />
      )}
    </NavigationContainer>
  );
}
