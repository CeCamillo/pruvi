import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle as SvgCircle, Path, Rect } from "react-native-svg";

// ─── Types ───────────────────────────────────────────────────────────────────

export type StatItem = {
  label: string;
  value: string;
  color?: string;
};

export type RoletaResultProps = {
  isCorrect: boolean;
  questionText: string;
  subject: string;
  tags: string[];
  selectedLetter: string;
  correctLetter: string;
  xp: number;
  time: string;
  // Correct-specific
  explanation?: string;
  highlightWords?: string[];
  // Error-specific
  tip?: string;
  errorExplanation?: string;
  // Stats
  stats?: StatItem[];
  onNext: () => void;
  onClose: () => void;
};

// ─── Icons ───────────────────────────────────────────────────────────────────

function ChallengeIcon() {
  return (
    <View style={styles.challengeIcon}>
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="white" />
      </Svg>
    </View>
  );
}

function BookmarkIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path d="M5 3h10a1 1 0 011 1v13.5l-5.5-3.5L5 17.5V4a1 1 0 011-1z" stroke="#6B6B6B" strokeWidth={1.5} strokeLinejoin="round" />
    </Svg>
  );
}

function SuccessIcon() {
  return (
    <View style={[styles.resultIconCircle, { backgroundColor: "#58CD04" }]}>
      <Svg width={28} height={28} viewBox="0 0 28 28" fill="none">
        <Path d="M7 14l5 5 9-9" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

function ErrorIcon() {
  return (
    <View style={[styles.resultIconCircle, { backgroundColor: "#EF4444" }]}>
      <Svg width={28} height={28} viewBox="0 0 28 28" fill="none">
        <Path d="M9 9l10 10M19 9L9 19" stroke="white" strokeWidth={3} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

function ShareIcon() {
  return (
    <View style={styles.shareBtn}>
      <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
        <Path d="M15 6.67a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM5 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM15 18.33a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM7.17 11.25l5.67 3.33M12.83 5.42L7.17 8.75" stroke="#6B6B6B" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

function InfoIcon() {
  return (
    <View style={styles.infoBtn}>
      <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
        <SvgCircle cx={9} cy={9} r={7.5} stroke="#6B6B6B" strokeWidth={1.5} />
        <Path d="M9 8.5V12.5M9 6h.01" stroke="#6B6B6B" strokeWidth={1.5} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

function PlayIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path d="M7 4l9 6-9 6V4z" fill="white" />
    </Svg>
  );
}

function StatsIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Rect x={2} y={10} width={4} height={8} rx={1} fill="#2B2B2B" />
      <Rect x={8} y={6} width={4} height={12} rx={1} fill="#2B2B2B" />
      <Rect x={14} y={2} width={4} height={16} rx={1} fill="#2B2B2B" />
    </Svg>
  );
}

function LightbulbIcon() {
  return (
    <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: "#F59E0B", alignItems: "center", justifyContent: "center" }}>
      <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
        <Path d="M8 1a5 5 0 00-2 9.58V12a1 1 0 001 1h2a1 1 0 001-1v-1.42A5 5 0 008 1zM6 14h4" stroke="white" strokeWidth={1.2} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

function ExplanationIcon() {
  return (
    <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: "#58CD04", alignItems: "center", justifyContent: "center" }}>
      <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
        <Rect x={3} y={2} width={10} height={12} rx={2} stroke="white" strokeWidth={1.2} />
        <Path d="M6 5.5h4M6 8h4M6 10.5h2.5" stroke="white" strokeWidth={1} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function RoletaResultScreen({
  isCorrect,
  questionText,
  subject,
  tags,
  selectedLetter,
  correctLetter,
  xp,
  time,
  explanation,
  tip,
  errorExplanation,
  stats,
  onNext,
  onClose,
}: RoletaResultProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top }]}>
        <View style={styles.topBarContent}>
          <ChallengeIcon />
          <View style={styles.topBarCenter}>
            <Text style={styles.topBarTitle}>Desafio da Roleta</Text>
            <Text style={styles.topBarMeta}>{subject.toUpperCase()} • QUESTÃO 1 DE 3</Text>
          </View>
          <Pressable onPress={onClose}><BookmarkIcon /></Pressable>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Tags */}
        <View style={styles.tagsRow}>
          {tags.map((tag, i) => (
            <View key={tag} style={[styles.tag, i === 0 ? styles.tagPrimary : styles.tagSecondary]}>
              <Text style={[styles.tagText, i === 0 ? styles.tagTextPrimary : styles.tagTextSecondary]}>{tag}</Text>
            </View>
          ))}
        </View>

        {/* Progress - full */}
        <View style={styles.progressRow}>
          <View style={[styles.progressSegment, styles.progressActive]} />
        </View>

        {/* Faded question */}
        <Text style={styles.fadedQuestion} numberOfLines={3}>{questionText}</Text>

        {/* Result banner */}
        <View style={[styles.resultBanner, isCorrect ? styles.resultBannerSuccess : styles.resultBannerError]}>
          {isCorrect ? <SuccessIcon /> : <ErrorIcon />}
          <View style={styles.resultBannerText}>
            <Text style={styles.resultBannerTitle}>
              {isCorrect ? "MANDOU BEM!" : "PÔXA, NÃO FOI!"}{" "}
              <Text style={styles.resultBannerLetter}>{isCorrect ? correctLetter : selectedLetter + correctLetter}</Text>
            </Text>
            <Text style={styles.resultBannerSub}>
              {isCorrect ? `+${xp} XP • ${time}` : "Aprenda com o erro e siga em frente."}
            </Text>
          </View>
        </View>

        {/* Action row */}
        <View style={styles.actionRow}>
          {isCorrect ? <ShareIcon /> : <InfoIcon />}
          <Pressable style={({ pressed }) => [styles.nextBtn, pressed && { opacity: 0.9 }]} onPress={onNext}>
            <Text style={styles.nextBtnText}>PRÓXIMA</Text>
            <PlayIcon />
          </Pressable>
        </View>

        {/* Explanation card (success) */}
        {isCorrect && explanation && (
          <View style={styles.explanationCard}>
            <View style={styles.explanationHeader}>
              <ExplanationIcon />
              <Text style={styles.explanationTitle}>Gabarito comentado</Text>
            </View>
            <Text style={styles.explanationText}>{explanation}</Text>
          </View>
        )}

        {/* Tip card (error) */}
        {!isCorrect && tip && (
          <View style={styles.tipCard}>
            <View style={styles.tipHeader}>
              <LightbulbIcon />
              <Text style={styles.tipTitle}>Dica Rápida</Text>
            </View>
            <Text style={styles.tipText}>{tip}</Text>
          </View>
        )}

        {/* Error explanation */}
        {!isCorrect && errorExplanation && (
          <View style={styles.errorExplanationCard}>
            <View style={styles.errorExplanationHeader}>
              <ExplanationIcon />
              <Text style={styles.errorExplanationTitle}>O que você errou?</Text>
            </View>
            <Text style={styles.explanationText}>{errorExplanation}</Text>
          </View>
        )}

        {/* Stats */}
        {stats && stats.length > 0 && (
          <View style={styles.statsSection}>
            <View style={styles.statsHeader}>
              <StatsIcon />
              <Text style={styles.statsTitle}>Estatísticas da Questão</Text>
            </View>
            <View style={styles.statsCard}>
              <Text style={styles.statsSubtitle}>Escolha dos Usuários (%)</Text>
              {stats.map((s) => (
                <View key={s.label} style={styles.statRow}>
                  <Text style={[styles.statLabel, s.color ? { color: s.color } : undefined]}>{s.label}</Text>
                  <Text style={[styles.statValue, s.color ? { color: s.color } : undefined]}>{s.value}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 40 },

  // Top bar
  topBar: { backgroundColor: "#FFFFFF" },
  topBarContent: { flexDirection: "row", alignItems: "center", paddingHorizontal: 24, paddingVertical: 12, gap: 12 },
  challengeIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#58CD04", alignItems: "center", justifyContent: "center" },
  topBarCenter: { flex: 1 },
  topBarTitle: { fontWeight: "900", fontSize: 14, lineHeight: 20, letterSpacing: -0.35, color: "#2B2B2B" },
  topBarMeta: { fontWeight: "700", fontSize: 10, lineHeight: 15, letterSpacing: 0.5, color: "#6B6B6B", textTransform: "uppercase" },

  // Tags
  tagsRow: { flexDirection: "row", gap: 8, marginTop: 16, marginBottom: 12 },
  tag: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 6 },
  tagPrimary: { backgroundColor: "rgba(88, 205, 4, 0.1)" },
  tagSecondary: { backgroundColor: "#F0F0F0" },
  tagText: { fontWeight: "900", fontSize: 11, lineHeight: 17, letterSpacing: 0.55 },
  tagTextPrimary: { color: "#58CD04" },
  tagTextSecondary: { color: "#6B6B6B" },

  // Progress
  progressRow: { flexDirection: "row", gap: 6, marginBottom: 16 },
  progressSegment: { flex: 1, height: 6, borderRadius: 3 },
  progressActive: { backgroundColor: "#58CD04" },

  // Faded question
  fadedQuestion: { fontWeight: "500", fontSize: 14, lineHeight: 22, color: "rgba(43, 43, 43, 0.4)", marginBottom: 20 },

  // Result banner
  resultBanner: { flexDirection: "row", alignItems: "center", borderRadius: 20, padding: 20, gap: 16, marginBottom: 16 },
  resultBannerSuccess: { backgroundColor: "rgba(88, 205, 4, 0.08)" },
  resultBannerError: { backgroundColor: "rgba(239, 68, 68, 0.08)" },
  resultIconCircle: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  resultBannerText: { flex: 1 },
  resultBannerTitle: { fontWeight: "900", fontSize: 18, lineHeight: 25, letterSpacing: -0.9, color: "#2B2B2B" },
  resultBannerLetter: { fontWeight: "900", color: "#6B6B6B" },
  resultBannerSub: { fontWeight: "700", fontSize: 12, lineHeight: 18, color: "#6B6B6B", marginTop: 2 },

  // Action row
  actionRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 24 },
  shareBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#F0F0F0", alignItems: "center", justifyContent: "center" },
  infoBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#F0F0F0", alignItems: "center", justifyContent: "center" },
  nextBtn: {
    flex: 1, height: 56, backgroundColor: "#58CD04", borderRadius: 16,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    shadowColor: "rgba(88, 205, 4, 0.2)", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 1, shadowRadius: 20, elevation: 5,
  },
  nextBtnText: { fontWeight: "900", fontSize: 16, lineHeight: 22, letterSpacing: 1.6, textTransform: "uppercase", color: "#FFFFFF" },

  // Explanation (success)
  explanationCard: {
    backgroundColor: "#FFFFFF", borderRadius: 24, borderWidth: 2, borderColor: "rgba(239, 236, 236, 0.4)",
    padding: 20, gap: 12, marginBottom: 24,
  },
  explanationHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  explanationTitle: { fontWeight: "900", fontSize: 14, lineHeight: 20, letterSpacing: -0.35, color: "#2B2B2B" },
  explanationText: { fontWeight: "500", fontSize: 14, lineHeight: 22, color: "#6B6B6B" },

  // Tip (error)
  tipCard: {
    backgroundColor: "rgba(255, 150, 0, 0.06)", borderRadius: 24, borderWidth: 1, borderColor: "rgba(255, 150, 0, 0.15)",
    padding: 20, gap: 12, marginBottom: 16,
  },
  tipHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  tipTitle: { fontWeight: "900", fontSize: 14, lineHeight: 20, letterSpacing: -0.35, color: "#2B2B2B" },
  tipText: { fontWeight: "500", fontSize: 14, lineHeight: 22, color: "#6B6B6B" },

  // Error explanation
  errorExplanationCard: {
    backgroundColor: "#FFFFFF", borderRadius: 24, borderWidth: 2, borderColor: "rgba(239, 236, 236, 0.4)",
    padding: 20, gap: 12, marginBottom: 24,
  },
  errorExplanationHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  errorExplanationTitle: { fontWeight: "900", fontSize: 14, lineHeight: 20, letterSpacing: -0.35, color: "#2B2B2B" },

  // Stats
  statsSection: { gap: 12 },
  statsHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  statsTitle: { fontWeight: "900", fontSize: 14, lineHeight: 20, letterSpacing: -0.35, color: "#2B2B2B" },
  statsCard: {
    backgroundColor: "#FFFFFF", borderRadius: 24, borderWidth: 2, borderColor: "rgba(239, 236, 236, 0.4)",
    padding: 20, gap: 10,
  },
  statsSubtitle: { fontWeight: "900", fontSize: 11, lineHeight: 17, letterSpacing: 0.55, color: "#6B6B6B", marginBottom: 4 },
  statRow: { flexDirection: "row", justifyContent: "space-between" },
  statLabel: { fontWeight: "700", fontSize: 13, lineHeight: 20, color: "#2B2B2B" },
  statValue: { fontWeight: "900", fontSize: 13, lineHeight: 20, color: "#2B2B2B" },
});
