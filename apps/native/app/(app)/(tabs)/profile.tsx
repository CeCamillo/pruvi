import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Button } from "heroui-native";
import { Text, View } from "react-native";

import { CharacterAvatar } from "@/components/gamification/CharacterAvatar";
import { StreakBadge } from "@/components/gamification/StreakBadge";
import { StudyCalendar } from "@/components/gamification/StudyCalendar";
import { XpCard } from "@/components/gamification/XpCard";
import { Screen } from "@/components/common/Screen";
import { Skeleton } from "@/components/common/Skeleton";
import { useCalendar } from "@/hooks/useCalendar";
import { useProfile } from "@/hooks/useProfile";
import { authClient } from "@/lib/auth-client";
import { currentMonth, formatMonthLabelPt } from "@/lib/date-format";
import { colors } from "@/lib/design-tokens";
import { authService } from "@/services/auth.service";

export default function ProfileScreen() {
  const profile = useProfile();
  const calendar = useCalendar();
  const { data: session } = authClient.useSession();
  const queryClient = useQueryClient();
  const router = useRouter();

  const currentMonthLabel = formatMonthLabelPt(new Date());

  const handleLogout = async () => {
    // Always clear local state and navigate, even if the server call
    // fails (offline, 5xx). Leaving the user stuck on the profile tab
    // with no way to retry is worse than a brief server-side session
    // that'll time out on its own.
    try {
      await authService.logout();
    } catch (err) {
      console.warn("[profile] logout request failed", err);
    } finally {
      queryClient.clear();
      router.replace("/(auth)/login");
    }
  };

  return (
    <Screen>
      <View style={{ alignItems: "center", gap: 16, paddingTop: 24 }}>
        <CharacterAvatar expression="happy" size={80} />
        <Text
          style={{
            fontSize: 22,
            fontWeight: "900",
            letterSpacing: -0.4,
            color: colors.text,
          }}
        >
          {session?.user?.name ?? "Estudante"}
        </Text>
        {profile.streaks && <StreakBadge count={profile.streaks.currentStreak} />}
      </View>

      <View style={{ marginTop: 24, gap: 16 }}>
        {profile.xp ? (
          <XpCard xp={profile.xp} />
        ) : (
          <Skeleton width="100%" height={80} />
        )}

        <Text
          style={{
            fontSize: 14,
            fontWeight: "900",
            letterSpacing: 0.5,
            textTransform: "uppercase",
            color: colors.textMuted,
            marginTop: 8,
          }}
        >
          {currentMonthLabel}
        </Text>

        {calendar.isLoading ? (
          <Skeleton width="100%" height={280} />
        ) : (
          <StudyCalendar
            dates={calendar.data?.dates ?? []}
            month={currentMonth()}
          />
        )}

        <Button variant="secondary" onPress={handleLogout} style={{ marginTop: 8 }}>
          <Button.Label>Sair</Button.Label>
        </Button>
      </View>
    </Screen>
  );
}
