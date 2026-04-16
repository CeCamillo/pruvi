import "@/global.css";
import { Redirect, Slot, useSegments } from "expo-router";
import { HeroUINativeProvider, Spinner } from "heroui-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { Text, View } from "react-native";

import { AppThemeProvider } from "@/contexts/app-theme-context";
import { authClient } from "@/lib/auth-client";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 2,
    },
  },
});

function AuthGate() {
  const { data: session, isPending, error } = authClient.useSession();
  const segments = useSegments();

  if (isPending) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <Spinner size="lg" />
      </View>
    );
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

  if (!session && !inAuthGroup) {
    return <Redirect href="/(auth)/login" />;
  }

  if (session && inAuthGroup) {
    return <Redirect href="/(app)/(tabs)" />;
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
