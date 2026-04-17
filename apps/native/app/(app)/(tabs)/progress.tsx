import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { useCallback } from "react";
import { Text, View } from "react-native";

import type { SubjectProgress } from "@pruvi/shared";

import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { Screen } from "@/components/common/Screen";
import { Skeleton } from "@/components/common/Skeleton";
import { SubjectCard } from "@/components/subject/SubjectCard";
import { useProgress } from "@/hooks/useProgress";
import { colors } from "@/lib/design-tokens";

export default function ProgressScreen() {
  const { data, isLoading, isError, refetch } = useProgress();
  const router = useRouter();

  const handlePress = useCallback(
    (slug: string) => {
      router.push(`/subject/${slug}`);
    },
    [router],
  );

  const renderItem = useCallback(
    ({ item }: { item: SubjectProgress }) => (
      <SubjectCard subject={item} onPress={handlePress} />
    ),
    [handlePress],
  );

  if (isLoading) {
    return (
      <Screen scrollable={false}>
        <View style={{ gap: 12, paddingTop: 16 }}>
          <Skeleton width="100%" height={96} />
          <Skeleton width="100%" height={96} />
          <Skeleton width="100%" height={96} />
        </View>
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen scrollable={false}>
        <ErrorState onRetry={refetch} />
      </Screen>
    );
  }

  const subjects = data?.subjects ?? [];

  return (
    <Screen scrollable={false}>
      <View style={{ paddingTop: 16, paddingBottom: 12 }}>
        <Text
          style={{
            fontSize: 24,
            fontWeight: "900",
            letterSpacing: -0.6,
            color: colors.text,
          }}
        >
          Seu progresso
        </Text>
        <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textMuted }}>
          Matérias que você está estudando
        </Text>
      </View>
      <FlashList
        data={subjects}
        estimatedItemSize={108}
        keyExtractor={(s) => s.slug}
        renderItem={renderItem}
        ListEmptyComponent={
          <EmptyState text="Complete uma sessão para ver seu progresso." />
        }
      />
    </Screen>
  );
}
