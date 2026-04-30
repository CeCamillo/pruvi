import { FlashList } from "@shopify/flash-list";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import type { ReviewItem, SubjectProgress } from "@pruvi/shared";

import { useProgress } from "@/hooks/useProgress";
import { useSubjectReviews } from "@/hooks/useSubjectReviews";
import { formatRelativeTime } from "@/lib/date-format";

// ─── Icons ───────────────────────────────────────────────────────────────────

function BackIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 18l-6-6 6-6"
        stroke="#2B2B2B"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function CheckCircleIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path
        d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 10l2 2 4-4"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function XCircleIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path
        d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 7l6 6M13 7l-6 6"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// ─── Components ──────────────────────────────────────────────────────────────

function SubjectHero({ subject }: { subject: SubjectProgress }) {
  const accuracyColor =
    subject.accuracy >= 75
      ? "#58CD04"
      : subject.accuracy >= 50
        ? "#FF9600"
        : "#EF4444";

  return (
    <View style={styles.heroCard}>
      <View style={styles.heroHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroEyebrow}>MATÉRIA</Text>
          <Text style={styles.heroName}>{subject.name}</Text>
        </View>
        <View
          style={[
            styles.accuracyPill,
            { backgroundColor: `${accuracyColor}1a`, borderColor: accuracyColor },
          ]}
        >
          <Text style={[styles.accuracyPillText, { color: accuracyColor }]}>
            {subject.accuracy}%
          </Text>
        </View>
      </View>

      <View style={styles.heroStatsRow}>
        <View style={styles.heroStat}>
          <Text style={styles.heroStatValue}>{subject.totalQuestions}</Text>
          <Text style={styles.heroStatLabel}>Respondidas</Text>
        </View>
        <View style={styles.heroStatDivider} />
        <View style={styles.heroStat}>
          <Text style={[styles.heroStatValue, { color: "#58CD04" }]}>
            {subject.correctCount}
          </Text>
          <Text style={styles.heroStatLabel}>Acertos</Text>
        </View>
        <View style={styles.heroStatDivider} />
        <View style={styles.heroStat}>
          <Text style={[styles.heroStatValue, { color: "#EF4444" }]}>
            {subject.totalQuestions - subject.correctCount}
          </Text>
          <Text style={styles.heroStatLabel}>Erros</Text>
        </View>
      </View>

      <View style={styles.heroBarBg}>
        <View
          style={[
            styles.heroBarFill,
            { width: `${subject.accuracy}%`, backgroundColor: accuracyColor },
          ]}
        />
      </View>
    </View>
  );
}

function ReviewRow({ review }: { review: ReviewItem }) {
  const accent = review.correct ? "#58CD04" : "#EF4444";
  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        {review.correct ? (
          <CheckCircleIcon color={accent} />
        ) : (
          <XCircleIcon color={accent} />
        )}
        <Text style={[styles.reviewStatus, { color: accent }]}>
          {review.correct ? "Acertou" : "Errou"}
        </Text>
        <Text style={styles.reviewTime}>
          {formatRelativeTime(review.reviewedAt)}
        </Text>
      </View>
      <Text style={styles.reviewBody} numberOfLines={3}>
        {review.body}
      </Text>
    </View>
  );
}

function HeaderBar({ title }: { title: string }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={[styles.topBar, { paddingTop: insets.top }]}>
      <View style={styles.topBarContent}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backBtn,
            pressed && { opacity: 0.7 },
          ]}
        >
          <BackIcon />
        </Pressable>
        <Text style={styles.topBarTitle}>{title}</Text>
        <View style={{ width: 36 }} />
      </View>
    </View>
  );
}

function LoadingState() {
  return (
    <View style={styles.centered}>
      <Text style={styles.centeredTitle}>Carregando…</Text>
    </View>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.centered}>
      <Text style={styles.centeredTitle}>Algo deu errado</Text>
      <Text style={styles.centeredBody}>
        Verifique sua conexão e tente novamente.
      </Text>
      <Pressable
        style={({ pressed }) => [
          styles.primaryBtn,
          pressed && { opacity: 0.9 },
        ]}
        onPress={onRetry}
      >
        <Text style={styles.primaryBtnText}>TENTAR NOVAMENTE</Text>
      </Pressable>
    </View>
  );
}

function NotFoundState() {
  return (
    <View style={styles.centered}>
      <Text style={styles.centeredTitle}>Matéria não encontrada</Text>
      <Text style={styles.centeredBody}>
        Comece uma sessão para começar a acompanhar esta matéria.
      </Text>
    </View>
  );
}

function EmptyReviews() {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>Nenhuma questão respondida ainda</Text>
      <Text style={styles.emptyBody}>
        Comece uma sessão para ver seu histórico aqui.
      </Text>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function SubjectScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const progress = useProgress();
  const reviews = useSubjectReviews(slug);

  const subject = progress.data?.subjects.find((s) => s.slug === slug);
  const reviewItems = reviews.data?.reviews ?? [];

  if (progress.isLoading || reviews.isLoading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <HeaderBar title="Matéria" />
        <LoadingState />
      </View>
    );
  }

  if (progress.isError || reviews.isError) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <HeaderBar title="Matéria" />
        <ErrorState
          onRetry={() => {
            progress.refetch();
            reviews.refetch();
          }}
        />
      </View>
    );
  }

  if (!subject) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <HeaderBar title="Matéria" />
        <NotFoundState />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <HeaderBar title={subject.name} />

      <FlashList
        data={reviewItems}
        keyExtractor={(r, i) => `${r.questionId}-${i}`}
        renderItem={({ item }) => <ReviewRow review={item} />}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={{ paddingTop: 16 }}>
            <SubjectHero subject={subject} />
            {reviewItems.length > 0 && (
              <Text style={styles.sectionLabel}>
                Histórico ({reviewItems.length})
              </Text>
            )}
          </View>
        }
        ListEmptyComponent={<EmptyReviews />}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFBFC" },
  topBar: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(239, 236, 236, 0.5)",
  },
  topBarContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(240, 240, 240, 0.5)",
  },
  topBarTitle: {
    fontWeight: "900",
    fontSize: 18,
    letterSpacing: -0.45,
    color: "#2B2B2B",
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    borderWidth: 2,
    borderColor: "rgba(239, 236, 236, 0.5)",
    padding: 24,
    gap: 20,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  heroHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  heroEyebrow: {
    fontWeight: "900",
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "#6B6B6B",
  },
  heroName: {
    fontWeight: "900",
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -0.6,
    color: "#2B2B2B",
    marginTop: 2,
  },
  accuracyPill: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
  },
  accuracyPillText: {
    fontWeight: "900",
    fontSize: 16,
    letterSpacing: -0.4,
  },
  heroStatsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  heroStat: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  heroStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: "rgba(107, 107, 107, 0.15)",
  },
  heroStatValue: {
    fontWeight: "900",
    fontSize: 22,
    letterSpacing: -0.55,
    color: "#2B2B2B",
  },
  heroStatLabel: {
    fontWeight: "700",
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: "#6B6B6B",
  },
  heroBarBg: {
    height: 12,
    borderRadius: 6,
    backgroundColor: "#F0F0F0",
  },
  heroBarFill: {
    height: 12,
    borderRadius: 6,
  },
  sectionLabel: {
    fontWeight: "900",
    fontSize: 12,
    lineHeight: 18,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#6B6B6B",
    marginBottom: 12,
  },
  reviewCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(239, 236, 236, 0.5)",
    padding: 16,
    marginBottom: 10,
    gap: 8,
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  reviewStatus: {
    fontWeight: "900",
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  reviewTime: {
    marginLeft: "auto",
    fontWeight: "700",
    fontSize: 11,
    color: "#6B6B6B",
  },
  reviewBody: {
    fontWeight: "500",
    fontSize: 14,
    lineHeight: 21,
    color: "#2B2B2B",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  centeredTitle: {
    fontWeight: "900",
    fontSize: 18,
    letterSpacing: -0.45,
    color: "#2B2B2B",
    textAlign: "center",
  },
  centeredBody: {
    fontWeight: "700",
    fontSize: 13,
    lineHeight: 20,
    color: "#6B6B6B",
    textAlign: "center",
    maxWidth: 280,
  },
  primaryBtn: {
    marginTop: 8,
    backgroundColor: "#58CD04",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 22,
  },
  primaryBtnText: {
    fontWeight: "900",
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "#FFFFFF",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 8,
  },
  emptyTitle: {
    fontWeight: "900",
    fontSize: 16,
    letterSpacing: -0.4,
    color: "#2B2B2B",
    textAlign: "center",
  },
  emptyBody: {
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 18,
    color: "#6B6B6B",
    textAlign: "center",
  },
});
