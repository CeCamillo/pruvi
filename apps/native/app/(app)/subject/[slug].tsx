import { FlashList } from "@shopify/flash-list";
import { Stack, useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";

import type { SubjectProgress } from "@pruvi/shared";

import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { NotFoundState } from "@/components/common/NotFoundState";
import { Screen } from "@/components/common/Screen";
import { Skeleton } from "@/components/common/Skeleton";
import { ReviewHistoryItem } from "@/components/subject/ReviewHistoryItem";
import { useProgress } from "@/hooks/useProgress";
import { useSubjectReviews } from "@/hooks/useSubjectReviews";
import { colors, radii } from "@/lib/design-tokens";

function SubjectHeader({ subject }: { subject: SubjectProgress }) {
  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: radii.xl,
        borderWidth: 2,
        borderColor: colors.border,
        padding: 20,
        marginVertical: 16,
        gap: 8,
      }}
    >
      <Text style={{ fontSize: 22, fontWeight: "900", color: colors.text }}>
        {subject.name}
      </Text>
      <View style={{ flexDirection: "row", gap: 16 }}>
        <Text style={{ fontSize: 14, fontWeight: "900", color: colors.primary }}>
          {subject.accuracy}% acerto
        </Text>
        <Text style={{ fontSize: 14, fontWeight: "700", color: colors.textMuted }}>
          {subject.totalQuestions} questões
        </Text>
      </View>
    </View>
  );
}

export default function SubjectScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const progress = useProgress();
  const reviews = useSubjectReviews(slug);

  const subject = progress.data?.subjects.find((s) => s.slug === slug);

  if (progress.isLoading || reviews.isLoading) {
    return (
      <Screen scrollable={false}>
        <Stack.Screen options={{ title: "Matéria" }} />
        <Skeleton width="100%" height={96} />
      </Screen>
    );
  }

  // Transient failure (network, server error) — offer a retry rather
  // than the terminal "matéria não encontrada" state.
  if (progress.isError || reviews.isError) {
    return (
      <Screen scrollable={false}>
        <Stack.Screen options={{ title: "Matéria" }} />
        <ErrorState
          onRetry={() => {
            progress.refetch();
            reviews.refetch();
          }}
        />
      </Screen>
    );
  }

  // Both queries succeeded but the slug isn't in the progress list —
  // either the subject doesn't exist or the user has never reviewed it.
  if (!subject) {
    return (
      <>
        <Stack.Screen options={{ title: "Matéria" }} />
        <NotFoundState />
      </>
    );
  }

  return (
    <Screen scrollable={false}>
      <Stack.Screen options={{ title: subject.name, headerBackTitle: "Voltar" }} />
      <SubjectHeader subject={subject} />
      <FlashList
        data={reviews.data?.reviews ?? []}
        estimatedItemSize={88}
        keyExtractor={(r, i) => `${r.questionId}-${i}`}
        renderItem={({ item }) => <ReviewHistoryItem review={item} />}
        ListEmptyComponent={
          <EmptyState text="Você ainda não respondeu questões desta matéria." />
        }
      />
    </Screen>
  );
}
