import { useRouter } from "expo-router";
import { useMemo } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path, Rect } from "react-native-svg";

import { useProgress } from "@/hooks/useProgress";
import { useXp } from "@/hooks/useXp";

// ─── Icons ───────────────────────────────────────────────────────────────────

function TrophyRingIcon({ progressPct }: { progressPct: number }) {
  const circumference = 2 * Math.PI * 28;
  const dashOffset = circumference - (progressPct / 100) * circumference;
  return (
    <View style={{ width: 64, height: 64, alignItems: "center", justifyContent: "center" }}>
      <Svg width={64} height={64} viewBox="0 0 64 64" fill="none">
        <Path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M4 32C4 16.536 16.536 4 32 4C47.464 4 60 16.536 60 32C60 47.464 47.464 60 32 60C16.536 60 4 47.464 4 32Z"
          stroke="#F0F0F0"
          strokeWidth={6}
        />
        <Path
          d={`M 32 4 A 28 28 0 ${progressPct >= 50 ? 1 : 0} 1 ${
            32 + 28 * Math.sin((progressPct / 100) * 2 * Math.PI)
          } ${32 - 28 * Math.cos((progressPct / 100) * 2 * Math.PI)}`}
          stroke="#58CD04"
          strokeWidth={6}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
        <Path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M32 22c1.784 0 3.253.157 4.377.347 1.139.192 1.708.288 2.184.874.476.586.45 1.22.4 2.485-.172 4.349-1.11 9.78-6.211 10.26v3.534h1.43c.476 0 .886.337.98.804l.19.946h2.65c.414 0 .75.336.75.75s-.336.75-.75.75h-12c-.414 0-.75-.336-.75-.75s.336-.75.75-.75h2.65l.19-.946c.093-.467.503-.804.98-.804h1.43v-3.534c-5.1-.48-6.038-5.912-6.21-10.26-.051-1.266-.076-1.9.4-2.485.475-.586 1.044-.682 2.183-.874C28.767 22.157 30.233 22 31.974 22z"
          fill="#58CD04"
        />
      </Svg>
    </View>
  );
}

function CheckIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 12l4 4 8-8"
        stroke="white"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function PencilIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"
        stroke="white"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function LockSmallIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M8 11V8a4 4 0 018 0v3M5 11h14a1 1 0 011 1v8a1 1 0 01-1 1H5a1 1 0 01-1-1v-8a1 1 0 011-1z"
        stroke="#6B6B6B"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function FireSmallIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2c-.25 1.05-.84 2.9-2 4.15C8.55 7.75 7 8.8 7 11.75c0 3.3 2.25 5.75 5 5.75s5-2.45 5-5.75c0-3.5-2.33-6.15-5-9.75z"
        fill="#6B6B6B"
      />
    </Svg>
  );
}

// ─── Data ────────────────────────────────────────────────────────────────────

type Achievement = {
  id: string;
  title: string;
  description: string;
  xp: string;
  icon: "check" | "pencil" | "lock" | "fire";
  iconBg: string;
  progress?: { current: number; total: number };
  completed?: boolean;
};

// Placeholder achievement data — full achievements system is Phase 8.3.
const UNLOCKED: Achievement[] = [
  {
    id: "1",
    title: "Primeira Vitória",
    description: "Complete sua primeira sessão",
    xp: "+10 XP",
    icon: "check",
    iconBg: "#58CD04",
    completed: true,
  },
];

const IN_PROGRESS: Achievement[] = [
  {
    id: "2",
    title: "Curioso",
    description: "Responda 10 questões",
    xp: "+10 XP",
    icon: "pencil",
    iconBg: "#F0F0F0",
    progress: { current: 0, total: 10 },
  },
  {
    id: "3",
    title: "Incendiário",
    description: "Mantenha ofensiva de 7 dias",
    xp: "+30 XP",
    icon: "fire",
    iconBg: "#F0F0F0",
    progress: { current: 0, total: 7 },
  },
  {
    id: "4",
    title: "Primeiros Passos",
    description: "Alcance 100 XP",
    xp: "+10 XP",
    icon: "lock",
    iconBg: "#F0F0F0",
    progress: { current: 0, total: 100 },
  },
];

const FILTERS = ["Todas", "XP", "Streak", "Questões"];

// ─── Components ──────────────────────────────────────────────────────────────

function AchievementIcon({
  icon,
  bg,
}: {
  icon: Achievement["icon"];
  bg: string;
}) {
  return (
    <View style={[styles.achieveIcon, { backgroundColor: bg }]}>
      {icon === "check" && <CheckIcon />}
      {icon === "pencil" && <PencilIcon />}
      {icon === "lock" && <LockSmallIcon />}
      {icon === "fire" && <FireSmallIcon />}
    </View>
  );
}

function AchievementCard({ item }: { item: Achievement }) {
  const pct = item.progress
    ? Math.min((item.progress.current / item.progress.total) * 100, 100)
    : 0;

  return (
    <View style={[styles.achieveCard, item.completed && styles.achieveCardCompleted]}>
      <View style={styles.achieveCardRow}>
        <AchievementIcon icon={item.icon} bg={item.iconBg} />
        <View style={styles.achieveCardInfo}>
          <Text style={styles.achieveCardTitle}>{item.title}</Text>
          <Text style={styles.achieveCardDesc}>{item.description}</Text>
          {item.progress && (
            <View style={styles.progressRow}>
              <Text style={styles.progressLabel}>
                {item.progress.current} / {item.progress.total}
              </Text>
              <View style={styles.progressBarBg}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${pct}%`,
                      backgroundColor: pct >= 100 ? "#58CD04" : "#FF9600",
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressPct}>{Math.round(pct)}%</Text>
            </View>
          )}
          <Text
            style={[
              styles.achieveXP,
              item.completed ? styles.achieveXPGreen : styles.achieveXPGray,
            ]}
          >
            {item.xp}
          </Text>
        </View>
      </View>
    </View>
  );
}

function SubjectRow({
  slug,
  name,
  accuracy,
  onPress,
}: {
  slug: string;
  name: string;
  accuracy: number;
  onPress: (slug: string) => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.subjectRow,
        pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
      ]}
      onPress={() => onPress(slug)}
    >
      <View style={styles.subjectRowHeader}>
        <Text style={styles.subjectName}>{name}</Text>
        <Text style={styles.subjectAccuracy}>{accuracy}%</Text>
      </View>
      <View style={styles.subjectBarBg}>
        <View
          style={[
            styles.subjectBarFill,
            {
              width: `${accuracy}%`,
              backgroundColor:
                accuracy >= 75
                  ? "#58CD04"
                  : accuracy >= 50
                    ? "#FF9600"
                    : "#EF4444",
            },
          ]}
        />
      </View>
    </Pressable>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const progress = useProgress();
  const xp = useXp();

  const subjects = progress.data?.subjects ?? [];
  const unlockedCount = UNLOCKED.length;
  const totalAchievements = UNLOCKED.length + IN_PROGRESS.length;

  // Overall progress: percent of the current level (a decent proxy until
  // an achievements backend exists).
  const overallPct = useMemo(() => {
    if (!xp.data) return 0;
    const { totalXp, xpForNextLevel } = xp.data;
    if (xpForNextLevel <= 0) return 0;
    return Math.min(100, Math.round(((totalXp % xpForNextLevel) / xpForNextLevel) * 100));
  }, [xp.data]);

  const handleSubjectPress = (slug: string) => {
    router.push(`/subject/${slug}`);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Conquistas</Text>
            <Text style={styles.headerSubtitle}>
              {unlockedCount} de {totalAchievements} desbloqueadas
            </Text>
          </View>
          <TrophyRingIcon progressPct={overallPct} />
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <View style={styles.overallCard}>
            <View style={styles.overallRow}>
              <Text style={styles.overallLabel}>Progresso do Nível</Text>
              <Text style={styles.overallPct}>{overallPct}%</Text>
            </View>
            <View style={styles.overallBarBg}>
              <View style={[styles.overallBarFill, { width: `${overallPct}%` }]} />
            </View>
          </View>
        </View>

        <View style={styles.filterRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}
          >
            {FILTERS.map((f, i) => (
              <Pressable
                key={f}
                style={[styles.filterBtn, i === 0 && styles.filterBtnActive]}
              >
                <View
                  style={[
                    styles.filterDot,
                    i === 0
                      ? { backgroundColor: "#FFFFFF" }
                      : { backgroundColor: "#6B6B6B" },
                  ]}
                />
                <Text style={[styles.filterText, i === 0 && styles.filterTextActive]}>
                  {f}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionDot} />
            <Text style={styles.sectionLabel}>
              Desbloqueadas ({UNLOCKED.length})
            </Text>
          </View>
          <View style={styles.achieveList}>
            {UNLOCKED.map((a) => (
              <AchievementCard key={a.id} item={a} />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionDot, { backgroundColor: "#6B6B6B" }]} />
            <Text style={styles.sectionLabel}>
              Em Progresso ({IN_PROGRESS.length})
            </Text>
          </View>
          <View style={styles.achieveList}>
            {IN_PROGRESS.map((a) => (
              <AchievementCard key={a.id} item={a} />
            ))}
          </View>
        </View>

        {subjects.length > 0 && (
          <View style={[styles.section, { marginBottom: 24 }]}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionDot, { backgroundColor: "#58CD04" }]} />
              <Text style={styles.sectionLabel}>
                Suas Matérias ({subjects.length})
              </Text>
            </View>
            <View style={styles.achieveList}>
              {subjects.map((s) => (
                <SubjectRow
                  key={s.slug}
                  slug={s.slug}
                  name={s.name}
                  accuracy={s.accuracy}
                  onPress={handleSubjectPress}
                />
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
  scrollContent: { paddingBottom: 40 },
  section: { paddingHorizontal: 24, marginBottom: 24 },
  header: { paddingHorizontal: 24, paddingBottom: 16 },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
  },
  headerTitle: {
    fontWeight: "900",
    fontSize: 32,
    lineHeight: 32,
    letterSpacing: -1.6,
    color: "#2B2B2B",
  },
  headerSubtitle: {
    fontWeight: "700",
    fontSize: 13,
    lineHeight: 20,
    color: "#6B6B6B",
    marginTop: 4,
    fontStyle: "italic",
  },
  overallCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 32,
    borderWidth: 2,
    borderColor: "rgba(239, 236, 236, 0.5)",
    padding: 26,
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  overallRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  overallLabel: {
    fontWeight: "900",
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.35,
    color: "#2B2B2B",
  },
  overallPct: {
    fontWeight: "900",
    fontSize: 14,
    lineHeight: 20,
    color: "#58CD04",
  },
  overallBarBg: {
    height: 14,
    borderRadius: 9999,
    backgroundColor: "#EFECEC",
  },
  overallBarFill: {
    height: 14,
    borderRadius: 9999,
    backgroundColor: "#58CD04",
  },
  filterRow: { marginBottom: 24 },
  filterScroll: { paddingHorizontal: 24, gap: 8 },
  filterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(240, 240, 240, 0.4)",
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  filterBtnActive: {
    backgroundColor: "#2B2B2B",
  },
  filterDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  filterText: {
    fontWeight: "900",
    fontSize: 11,
    lineHeight: 17,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: "#6B6B6B",
  },
  filterTextActive: {
    color: "#FFFFFF",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#58CD04",
  },
  sectionLabel: {
    fontWeight: "900",
    fontSize: 13,
    lineHeight: 20,
    letterSpacing: -0.33,
    color: "#6B6B6B",
    fontStyle: "italic",
  },
  achieveList: { gap: 12 },
  achieveCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(239, 236, 236, 0.5)",
    padding: 18,
  },
  achieveCardCompleted: {
    backgroundColor: "rgba(88, 205, 4, 0.08)",
    borderColor: "rgba(88, 205, 4, 0.25)",
    borderWidth: 2,
  },
  achieveCardRow: {
    flexDirection: "row",
    gap: 16,
  },
  achieveIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  achieveCardInfo: { flex: 1, gap: 4 },
  achieveCardTitle: {
    fontWeight: "900",
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: -0.38,
    color: "#2B2B2B",
  },
  achieveCardDesc: {
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 18,
    color: "#6B6B6B",
  },
  achieveXP: {
    fontWeight: "900",
    fontSize: 11,
    lineHeight: 17,
    letterSpacing: 0.55,
    marginTop: 4,
  },
  achieveXPGreen: { color: "#58CD04" },
  achieveXPGray: { color: "#6B6B6B" },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  progressLabel: {
    fontWeight: "900",
    fontSize: 10,
    lineHeight: 15,
    color: "#6B6B6B",
    minWidth: 50,
  },
  progressBarBg: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#F0F0F0",
  },
  progressBarFill: {
    height: 8,
    borderRadius: 4,
  },
  progressPct: {
    fontWeight: "900",
    fontSize: 10,
    lineHeight: 15,
    color: "#58CD04",
    minWidth: 35,
    textAlign: "right",
  },
  subjectRow: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(239, 236, 236, 0.5)",
    padding: 16,
    gap: 8,
  },
  subjectRowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  subjectName: {
    fontWeight: "900",
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.35,
    color: "#2B2B2B",
  },
  subjectAccuracy: {
    fontWeight: "900",
    fontSize: 14,
    lineHeight: 20,
    color: "#58CD04",
  },
  subjectBarBg: {
    height: 10,
    borderRadius: 5,
    backgroundColor: "#F0F0F0",
  },
  subjectBarFill: {
    height: 10,
    borderRadius: 5,
  },
});
