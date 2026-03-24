import { Card, useThemeColor } from "heroui-native";
import { Text, View, Pressable } from "react-native";

import { Container } from "@/components/container";
import { SignIn } from "@/components/sign-in";
import { SignUp } from "@/components/sign-up";
import { authClient } from "@/lib/auth-client";

export default function Home() {
  const { data: session } = authClient.useSession();

  const _mutedColor = useThemeColor("muted");
  const _successColor = useThemeColor("success");
  const _dangerColor = useThemeColor("danger");
  const _foregroundColor = useThemeColor("foreground");

  return (
    <Container className="p-6">
      <View className="py-4 mb-6">
        <Text className="text-4xl font-bold text-foreground mb-2">BETTER T STACK</Text>
      </View>

      {session?.user ? (
        <Card variant="secondary" className="mb-6 p-4">
          <Text className="text-foreground text-base mb-2">
            Welcome, <Text className="font-medium">{session.user.name}</Text>
          </Text>
          <Text className="text-muted text-sm mb-4">{session.user.email}</Text>
          <Pressable
            className="bg-danger py-3 px-4 rounded-lg self-start active:opacity-70"
            onPress={() => {
              void authClient.signOut();
            }}
          >
            <Text className="text-foreground font-medium">Sign Out</Text>
          </Pressable>
        </Card>
      ) : null}

      {!session?.user && (
        <>
          <SignIn />
          <SignUp />
        </>
      )}
    </Container>
  );
}
