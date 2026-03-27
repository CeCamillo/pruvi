import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle as SvgCircle, Path, Rect } from "react-native-svg";

// ─── Icons ───────────────────────────────────────────────────────────────────

function ShareIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path d="M15 6.67a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM5 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM15 18.33a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM7.17 11.25l5.67 3.33M12.83 5.42L7.17 8.75" stroke="#58CD04" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function SettingsIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" stroke="#6B6B6B" strokeWidth={1.5} />
      <Path d="M16.167 10a1.2 1.2 0 00.233-.917l-.683-3.5a1.2 1.2 0 00-.45-.717L12.1 2.5 10 1.667 7.9 2.5l-3.167 2.366a1.2 1.2 0 00-.45.717l-.683 3.5A1.2 1.2 0 003.833 10l-.233.917.683 3.5c.067.283.225.533.45.717L7.9 17.5l2.1.833 2.1-.833 3.167-2.366c.225-.184.383-.434.45-.717l.683-3.5A1.2 1.2 0 0016.167 10z" stroke="#6B6B6B" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CrownIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path d="M3.33 10l2.5-6.67L10 6.67l4.17-3.34 2.5 6.67-3.34 3.33H6.67L3.33 10z" fill="#FF9600" />
      <Rect x={5} y={13.33} width={10} height={3.33} rx={1} fill="#FF9600" />
    </Svg>
  );
}

function StarIconGreen() {
  return (
    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(88, 205, 4, 0.15)", alignItems: "center", justifyContent: "center" }}>
      <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
        <Path d="M10 2l2.09 6.26L18.18 9l-5 4.27L14.82 20 10 16.9 5.18 20l1.64-6.73L1.82 9l6.09-.74L10 2z" fill="#58CD04" />
      </Svg>
    </View>
  );
}

function FireIconCircle() {
  return (
    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255, 150, 0, 0.1)", alignItems: "center", justifyContent: "center" }}>
      <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
        <Path d="M10 1.67c-.21.88-.7 2.41-1.67 3.46C7.13 6.46 5.83 7.33 5.83 9.79c0 2.75 1.88 4.8 4.17 4.8s4.17-2.05 4.17-4.8c0-2.91-1.94-5.12-4.17-8.12z" fill="#FF9600" />
      </Svg>
    </View>
  );
}

function RouteIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Rect width={24} height={24} rx={6} fill="#6366F1" />
      <Path d="M7 12l3 3 7-7" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function GradCapIcon() {
  return (
    <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: "rgba(99, 102, 241, 0.15)", alignItems: "center", justifyContent: "center" }}>
      <Svg width={28} height={28} viewBox="0 0 28 28" fill="none">
        <Path d="M14 4L3 9.5 14 15l11-5.5L14 4zM6 12v5c0 2 3.5 4 8 4s8-2 8-4v-5" stroke="#6366F1" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

function CheckCircleWhite() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <SvgCircle cx={9} cy={9} r={9} fill="rgba(255,255,255,0.3)" />
      <Path d="M5.5 9l2.5 2.5 4.5-4.5" stroke="white" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function BackIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path d="M15 18l-6-6 6-6" stroke="#2B2B2B" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ─── Calendar Data ───────────────────────────────────────────────────────────

const DAYS_OF_WEEK = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// Feb 2026 starts on Sunday (index 0), 28 days
const CALENDAR_DAYS: (number | null)[] = [
  1,2,3,4,5,6,7,
  8,9,10,11,12,13,14,
  15,16,17,18,19,20,21,
  22,23,24,25,26,27,28,
];

const STUDIED_DAYS = new Set([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,19,20,21,22,23,24,25,26,27,28]);
const TODAY = 20;

// ─── Components ──────────────────────────────────────────────────────────────

function ProfileHeader() {
  return (
    <View style={styles.profileHeader}>
      {/* Avatar */}
      <View style={styles.avatarContainer}>
        <View style={styles.avatarRing}>
          <View style={styles.avatarInner}>
            <View style={styles.avatarPlaceholder} />
          </View>
        </View>
        <View style={styles.crownBadge}>
          <CrownIcon />
        </View>
      </View>

      {/* Name */}
      <Text style={styles.profileName}>Guilherme Kauark</Text>
      <Text style={styles.profileSubtitle}>Estudante Premium</Text>

      {/* Level progress */}
      <View style={styles.levelCard}>
        <Text style={styles.levelLabel}>Nível de Especialista</Text>
        <Text style={styles.levelPercent}>42%</Text>
        <View style={styles.levelBarBg}>
          <View style={[styles.levelBarFill, { width: "42%" }]} />
        </View>
      </View>
    </View>
  );
}

function DestaquesSection() {
  return (
    <View style={styles.destaquesSection}>
      <Text style={styles.sectionTitle}>Destaques</Text>
      <View style={styles.destaquesRow}>
        <View style={styles.destaqueCard}>
          <StarIconGreen />
          <Text style={styles.destaqueLabel}>Total XP</Text>
          <Text style={styles.destaqueValue}>12,450</Text>
        </View>
        <View style={styles.destaqueCard}>
          <FireIconCircle />
          <Text style={styles.destaqueLabel}>Ofensiva</Text>
          <Text style={styles.destaqueValue}>28 dias</Text>
        </View>
      </View>
    </View>
  );
}

function AtividadeSection() {
  return (
    <View style={styles.atividadeSection}>
      <View style={styles.atividadeHeader}>
        <Text style={styles.sectionTitle}>Atividade</Text>
        <View style={styles.monthBadge}>
          <Text style={styles.monthText}>Fevereiro 2026</Text>
        </View>
      </View>

      {/* Calendar */}
      <View style={styles.calendarCard}>
        {/* Week day headers */}
        <View style={styles.calendarRow}>
          {DAYS_OF_WEEK.map((d) => (
            <View key={d} style={styles.calendarCell}>
              <Text style={styles.calendarDayHeader}>{d}</Text>
            </View>
          ))}
        </View>

        {/* Day cells */}
        {Array.from({ length: 4 }, (_, weekIdx) => (
          <View key={weekIdx} style={styles.calendarRow}>
            {CALENDAR_DAYS.slice(weekIdx * 7, weekIdx * 7 + 7).map((day, i) => {
              if (day === null) return <View key={i} style={styles.calendarCell} />;
              const studied = STUDIED_DAYS.has(day);
              const isToday = day === TODAY;
              return (
                <View key={day} style={styles.calendarCell}>
                  <View style={[
                    styles.dayBox,
                    studied ? styles.dayStudied : styles.dayEmpty,
                    isToday && styles.dayToday,
                  ]}>
                    <Text style={[styles.dayText, studied && styles.dayTextStudied]}>{day}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        ))}

        {/* Legend */}
        <View style={styles.calendarLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#84CC16" }]} />
            <Text style={styles.legendText}>Estudado</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#F0F0F0" }]} />
            <Text style={styles.legendText}>Vazio</Text>
          </View>
          <Text style={styles.legendTotal}>Total: 28 Dias</Text>
        </View>
      </View>
    </View>
  );
}

function TrilhaAtivaSection() {
  return (
    <View style={styles.trilhaAtivaCard}>
      <View style={styles.trilhaAtivaHeader}>
        <RouteIcon />
        <Text style={styles.trilhaAtivaTitle}>Trilha Ativa</Text>
      </View>
      <View style={styles.trilhaAtivaContent}>
        <GradCapIcon />
        <View style={styles.trilhaAtivaInfo}>
          <Text style={styles.trilhaAtivaName}>ENEM 2024</Text>
          <Text style={styles.trilhaAtivaSub}>Medicina</Text>
        </View>
        <Pressable style={styles.alterarBtn}>
          <Text style={styles.alterarBtnText}>ALTERAR</Text>
        </Pressable>
      </View>
    </View>
  );
}

function PremiumCard() {
  return (
    <LinearGradient
      colors={["#84CC16", "#65A30D"]}
      style={styles.premiumCard}
    >
      <View style={styles.premiumBadge}>
        <CrownIcon />
        <Text style={styles.premiumBadgeText}>Sleek Premium</Text>
      </View>
      <Text style={styles.premiumTitle}>Potencial Máximo</Text>
      <View style={styles.premiumFeatures}>
        <View style={styles.premiumFeatureRow}>
          <CheckCircleWhite />
          <Text style={styles.premiumFeatureText}>Simulados Ilimitados</Text>
        </View>
        <View style={styles.premiumFeatureRow}>
          <CheckCircleWhite />
          <Text style={styles.premiumFeatureText}>IA Tira-Dúvidas 24h</Text>
        </View>
      </View>
      <Pressable style={({ pressed }) => [styles.upgradeBtn, pressed && { opacity: 0.9 }]}>
        <Text style={styles.upgradeBtnText}>UPGRADE</Text>
      </Pressable>
    </LinearGradient>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top }]}>
        <View style={styles.topBarContent}>
          <Pressable onPress={() => router.back()}>
            <BackIcon />
          </Pressable>
          <Text style={styles.topBarTitle}>Meu Perfil</Text>
          <View style={styles.topBarActions}>
            <Pressable style={styles.topBarBtn}>
              <ShareIcon />
            </Pressable>
            <Pressable style={styles.topBarBtnGray}>
              <SettingsIcon />
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <ProfileHeader />
        <View style={styles.sections}>
          <DestaquesSection />
          <AtividadeSection />
          <TrilhaAtivaSection />
          <PremiumCard />
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 40 },

  // ─── Top Bar ──────────────────────────────────────────────────────────────
  topBar: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(239, 236, 236, 0.5)",
  },
  topBarContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  topBarTitle: {
    fontWeight: "700",
    fontSize: 20,
    lineHeight: 28,
    color: "#2B2B2B",
  },
  topBarActions: {
    flexDirection: "row",
    gap: 8,
  },
  topBarBtn: {
    width: 36,
    height: 36,
    borderRadius: 16,
    backgroundColor: "rgba(88, 205, 4, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(88, 205, 4, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  topBarBtnGray: {
    width: 36,
    height: 36,
    borderRadius: 16,
    backgroundColor: "rgba(240, 240, 240, 0.5)",
    alignItems: "center",
    justifyContent: "center",
  },

  // ─── Profile Header ───────────────────────────────────────────────────────
  profileHeader: {
    alignItems: "center",
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(239, 236, 236, 0.5)",
  },
  avatarContainer: { position: "relative", marginBottom: 12 },
  avatarRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: "#58CD04",
    padding: 3,
  },
  avatarInner: {
    flex: 1,
    borderRadius: 37,
    overflow: "hidden",
  },
  avatarPlaceholder: {
    flex: 1,
    backgroundColor: "#E8F5E9",
  },
  crownBadge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 2,
  },
  profileName: {
    fontWeight: "900",
    fontSize: 20,
    lineHeight: 28,
    letterSpacing: -0.5,
    color: "#2B2B2B",
    textAlign: "center",
  },
  profileSubtitle: {
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 18,
    color: "#6B6B6B",
    textAlign: "center",
    marginTop: 2,
  },
  levelCard: {
    width: 390,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#EFECEC",
    padding: 16,
    marginTop: 16,
    marginHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  levelLabel: {
    fontWeight: "900",
    fontSize: 12,
    lineHeight: 18,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: "#6B6B6B",
    flex: 1,
  },
  levelPercent: {
    fontWeight: "900",
    fontSize: 14,
    lineHeight: 20,
    color: "#58CD04",
  },
  levelBarBg: {
    width: "100%",
    height: 8,
    borderRadius: 4,
    backgroundColor: "#F0F0F0",
    marginTop: 4,
  },
  levelBarFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#58CD04",
  },

  // ─── Sections ─────────────────────────────────────────────────────────────
  sections: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 24,
  },
  sectionTitle: {
    fontWeight: "900",
    fontSize: 18,
    lineHeight: 25,
    letterSpacing: -0.9,
    color: "#2B2B2B",
  },

  // ─── Destaques ────────────────────────────────────────────────────────────
  destaquesSection: { gap: 16 },
  destaquesRow: { flexDirection: "row", gap: 12 },
  destaqueCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "rgba(239, 236, 236, 0.5)",
    padding: 20,
    gap: 12,
  },
  destaqueLabel: {
    fontWeight: "900",
    fontSize: 12,
    lineHeight: 18,
    letterSpacing: -0.3,
    color: "#6B6B6B",
  },
  destaqueValue: {
    fontWeight: "900",
    fontSize: 28,
    lineHeight: 28,
    letterSpacing: -1.4,
    color: "#2B2B2B",
  },

  // ─── Atividade ────────────────────────────────────────────────────────────
  atividadeSection: { gap: 16 },
  atividadeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  monthBadge: {
    backgroundColor: "rgba(88, 205, 4, 0.1)",
    borderRadius: 9999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  monthText: {
    fontWeight: "900",
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#58CD04",
  },
  calendarCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "rgba(239, 236, 236, 0.5)",
    padding: 16,
    gap: 4,
  },
  calendarRow: {
    flexDirection: "row",
  },
  calendarCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 2,
  },
  calendarDayHeader: {
    fontWeight: "700",
    fontSize: 9,
    lineHeight: 14,
    letterSpacing: 0.5,
    color: "#6B6B6B",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  dayBox: {
    width: 38,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  dayStudied: {
    backgroundColor: "#84CC16",
  },
  dayEmpty: {
    backgroundColor: "rgba(240, 240, 240, 0.5)",
  },
  dayToday: {
    borderWidth: 2,
    borderColor: "#FF9600",
  },
  dayText: {
    fontWeight: "900",
    fontSize: 11,
    lineHeight: 16,
    color: "#6B6B6B",
  },
  dayTextStudied: {
    color: "#FFFFFF",
  },
  calendarLegend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 8,
    paddingTop: 8,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontWeight: "700",
    fontSize: 9,
    lineHeight: 14,
    color: "#6B6B6B",
  },
  legendTotal: {
    fontWeight: "900",
    fontSize: 9,
    lineHeight: 14,
    color: "#58CD04",
    marginLeft: "auto",
  },

  // ─── Trilha Ativa ─────────────────────────────────────────────────────────
  trilhaAtivaCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    borderWidth: 2,
    borderColor: "#EFECEC",
    padding: 20,
    gap: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  trilhaAtivaHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  trilhaAtivaTitle: {
    fontWeight: "900",
    fontSize: 16,
    lineHeight: 23,
    letterSpacing: -0.4,
    color: "#6366F1",
  },
  trilhaAtivaContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  trilhaAtivaInfo: { flex: 1 },
  trilhaAtivaName: {
    fontWeight: "900",
    fontSize: 18,
    lineHeight: 25,
    letterSpacing: -0.9,
    color: "#2B2B2B",
  },
  trilhaAtivaSub: {
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 18,
    color: "#6B6B6B",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  alterarBtn: {
    backgroundColor: "rgba(240, 240, 240, 0.5)",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  alterarBtnText: {
    fontWeight: "900",
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#6B6B6B",
  },

  // ─── Premium Card ─────────────────────────────────────────────────────────
  premiumCard: {
    borderRadius: 32,
    padding: 24,
    gap: 16,
    shadowColor: "rgba(185, 248, 207, 0.5)",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 1,
    shadowRadius: 25,
    elevation: 8,
  },
  premiumBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  premiumBadgeText: {
    fontWeight: "900",
    fontSize: 12,
    lineHeight: 18,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "rgba(255, 255, 255, 0.8)",
  },
  premiumTitle: {
    fontWeight: "900",
    fontSize: 28,
    lineHeight: 28,
    letterSpacing: -1.4,
    color: "#FFFFFF",
    fontStyle: "italic",
  },
  premiumFeatures: { gap: 10 },
  premiumFeatureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  premiumFeatureText: {
    fontWeight: "700",
    fontSize: 13,
    lineHeight: 20,
    color: "rgba(255, 255, 255, 0.9)",
  },
  upgradeBtn: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 4,
  },
  upgradeBtnText: {
    fontWeight: "900",
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: "#58CD04",
  },
});
