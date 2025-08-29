import React, { memo, useEffect } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";
import { FriendProvider } from "../contexts/FriendContext";
import { AuthProvider } from "../utils/auth/useAuth";

SplashScreen.preventAutoHideAsync();

const RootLayout = memo(() => {
  const colorScheme = useColorScheme();

  useEffect(() => {
    // Hide splash screen immediately
    SplashScreen.hideAsync();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
      <AuthProvider>
        <FriendProvider>
          <Stack
            screenOptions={{
              headerShown: false,
              animation: "none", // Disable animations for better performance
            }}
            initialRouteName="index"
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="(tabs)" />
          </Stack>
        </FriendProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
});

RootLayout.displayName = 'RootLayout';

export default RootLayout;
