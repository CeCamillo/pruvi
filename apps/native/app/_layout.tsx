import "@/global.css";
import { Redirect, Slot, useSegments } from "expo-router";
import { HeroUINativeProvider, Spinner } from "heroui-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { Text, View } from "react-native";

import { AppThemeProvider } from "@/contexts/app-theme-context";
import { authClient } from "@/lib/auth-client";
import { usePreferences } from "@/hooks/useOnboarding";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 2,
    },
  },
});

function LoadingScreen() {
  return (
    <View className="flex-1 bg-background items-center justify-center">
      <Spinner size="lg" />
    </View>
  );
}

function AuthGate() {
  const { data: session, isPending, error } = authClient.useSession();
  const segments = useSegments();
  // Only fetch preferences once we have a session — the endpoint is auth-gated
  // and would 401 for unauthenticated users.
  const prefs = usePreferences({ enabled: !!session });

  if (isPending) {
    return <LoadingScreen />;
  }

  if (error) {
    return (
      <View className="flex-1 bg-background items-center justify-center px-8">
        <Text className="text-foreground text-base text-center">
          Não foi possível verificar sua sessão. Verifique sua conexão e tente novamente.
        </Text>
      </View>
    );
  }

  const inAuthGroup = segments[0] === "(auth)";
  const inOnboardingGroup = segments[0] === "(onboarding)";

  if (!session && !inAuthGroup) {
    return <Redirect href="/(auth)/login" />;
  }

  if (session && inAuthGroup) {
    return <Redirect href="/(app)/(tabs)" />;
  }

  // Authenticated from here on. Wait for the preferences query to settle
  // before routing the user into or out of the onboarding stack — otherwise
  // we'd flash the wrong screen on cold start.
  if (session) {
    if (prefs.isPending) {
      return <LoadingScreen />;
    }
    const onboardingCompleted = prefs.data?.onboardingCompleted === true;

    if (!onboardingCompleted && !inOnboardingGroup) {
      return <Redirect href="/(onboarding)/start" />;
    }
    if (onboardingCompleted && inOnboardingGroup) {
      return <Redirect href="/(app)/(tabs)" />;
    }
  }

  return <Slot />;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <QueryClientProvider client={queryClient}>
          <AppThemeProvider>
            <HeroUINativeProvider>
              <AuthGate />
            </HeroUINativeProvider>
          </AppThemeProvider>
        </QueryClientProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
