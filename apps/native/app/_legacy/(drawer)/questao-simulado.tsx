import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle as SvgCircle, Path, Rect } from "react-native-svg";

// ─── Icons ───────────────────────────────────────────────────────────────────

function CloseIcon() {
  return (
    <View style={styles.closeBtn}>
      <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
        <Path d="M12 4L4 12M4 4l8 8" stroke="white" strokeWidth={2} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

function ChecklistIcon() {
  return (
    <View style={styles.checklistBtn}>
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Path d="M4 7l2.5 2L11 5M4 13l2.5 2L11 11M4 19l2.5 2L11 17" stroke="#58CD04" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M14 7h6M14 13h6M14 19h6" stroke="#58CD04" strokeWidth={1.5} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

function FlagIcon() {
  return (
    <View style={styles.flagBtn}>
      <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
        <Path d="M3.33 12.5V3.33s1.67-.83 5-.83 5 1.67 8.34 1.67 5-.84 5-.84v9.17s-1.67.84-5 .84-5-1.67-8.34-1.67-5 .83-5 .83zM3.33 18.33v-5.83" stroke="#2B2B2B" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

function CheckBadgeIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
      <SvgCircle cx={11} cy={11} r={9} fill="rgba(255,255,255,0.3)" />
      <Path d="M7 11l2.5 2.5 5.5-5.5" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ImagePlaceholderIcon() {
  return (
    <Svg width={32} height={32} viewBox="0 0 32 32" fill="none">
      <Rect x={4} y={6} width={24} height={20} rx={3} stroke="#BFBFBF" strokeWidth={1.5} />
      <SvgCircle cx={12} cy={13} r={2.5} stroke="#BFBFBF" strokeWidth={1.5} />
      <Path d="M4 22l6-5 4 3 5-4 9 6" stroke="#BFBFBF" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ─── Data ────────────────────────────────────────────────────────────────────

const QUESTION = {
  examName: "Simulado ENEM 2024",
  current: 6,
  total: 90,
  tags: [
    { label: "Matemática", color: "#DBEAFE" },
    { label: "ENEM 2022", color: "#F0F0F0" },
  ],
  text: "Um mestre de obras deseja construir uma rampa de acesso ligando o solo a uma plataforma elevada. A altura da plataforma é de 1,5 metros e a inclinação da rampa deve ser de 30° em relação ao solo.",
  imageCaption: "Figura Ilustrativa",
  questionText: "Qual deve ser o comprimento total da rampa em metros?",
  options: [
    { letter: "A", text: "1,5 metros" },
    { letter: "B", text: "2,0 metros" },
    { letter: "C", text: "3,0 metros" },
    { letter: "D", text: "4,5 metros" },
    { letter: "E", text: "5,0 metros" },
  ],
};

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function QuestaoSimuladoScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [selected, setSelected] = useState<string>("C");
  const progress = (QUESTION.current / QUESTION.total) * 100;

  return (
    <View style={styles.container}>
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top }]}>
        <View style={styles.topBarContent}>
          <Pressable onPress={() => router.back()}>
            <CloseIcon />
          </Pressable>

          <View style={styles.topBarCenter}>
            <View style={styles.topBarTitles}>
              <Text style={styles.topBarExam}>{QUESTION.examName}</Text>
              <Text style={styles.topBarQuestion}>
                Questão {String(QUESTION.current).padStart(2, "0")} de {QUESTION.total}
              </Text>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
            </View>
          </View>

          <ChecklistIcon />
        </View>
      </View>

      {/* Content */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Tags */}
        <View style={styles.tagsRow}>
          {QUESTION.tags.map((tag) => (
            <View key={tag.label} style={[styles.tag, { backgroundColor: tag.color }]}>
              <Text style={styles.tagText}>{tag.label}</Text>
            </View>
          ))}
        </View>

        {/* Question text */}
        <Text style={styles.questionBody}>{QUESTION.text}</Text>

        {/* Image placeholder */}
        <View style={styles.imagePlaceholder}>
          <ImagePlaceholderIcon />
          <Text style={styles.imageCaption}>{QUESTION.imageCaption}</Text>
        </View>

        {/* Question prompt */}
        <Text style={styles.questionPrompt}>{QUESTION.questionText}</Text>

        {/* Options */}
        <View style={styles.optionsList}>
          {QUESTION.options.map((opt) => {
            const isSelected = selected === opt.letter;
            return (
              <Pressable
                key={opt.letter}
                style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                onPress={() => setSelected(opt.letter)}
              >
                <View style={[styles.optionLetter, isSelected && styles.optionLetterSelected]}>
                  <Text style={[styles.optionLetterText, isSelected && styles.optionLetterTextSelected]}>
                    {opt.letter}
                  </Text>
                </View>
                <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>{opt.text}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* Bottom bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.bottomBarContent}>
          <FlagIcon />
          <Pressable style={({ pressed }) => [styles.confirmBtn, pressed && { opacity: 0.9 }]}>
            <Text style={styles.confirmBtnText}>CONFIRMAR</Text>
            <CheckBadgeIcon />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 24 },

  // ─── Top Bar ──────────────────────────────────────────────────────────────
  topBar: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(239, 236, 236, 0.5)",
  },
  topBarContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
    gap: 16,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: "#2B2B2B",
    alignItems: "center",
    justifyContent: "center",
  },
  topBarCenter: { flex: 1, gap: 6 },
  topBarTitles: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  topBarExam: {
    fontWeight: "900",
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.35,
    color: "#58CD04",
  },
  topBarQuestion: {
    fontWeight: "900",
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.35,
    color: "#6B6B6B",
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#F0F0F0",
  },
  progressBarFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#58CD04",
  },
  checklistBtn: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: "rgba(88, 205, 4, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(88, 205, 4, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },

  // ─── Tags ─────────────────────────────────────────────────────────────────
  tagsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 24,
    marginBottom: 20,
  },
  tag: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  tagText: {
    fontWeight: "900",
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "#2B2B2B",
  },

  // ─── Question Body ────────────────────────────────────────────────────────
  questionBody: {
    fontWeight: "500",
    fontSize: 15,
    lineHeight: 24,
    color: "#2B2B2B",
    marginBottom: 20,
  },

  // ─── Image Placeholder ────────────────────────────────────────────────────
  imagePlaceholder: {
    backgroundColor: "rgba(240, 240, 240, 0.3)",
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "rgba(239, 236, 236, 0.5)",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 12,
    marginBottom: 20,
  },
  imageCaption: {
    fontWeight: "700",
    fontSize: 11,
    lineHeight: 17,
    color: "#6B6B6B",
    fontStyle: "italic",
  },

  // ─── Question Prompt ──────────────────────────────────────────────────────
  questionPrompt: {
    fontWeight: "900",
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: -0.4,
    color: "#2B2B2B",
    marginBottom: 20,
  },

  // ─── Options ──────────────────────────────────────────────────────────────
  optionsList: { gap: 12 },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(239, 236, 236, 0.4)",
    paddingHorizontal: 20,
    height: 68,
    gap: 16,
  },
  optionCardSelected: {
    backgroundColor: "rgba(88, 205, 4, 0.05)",
    borderColor: "#58CD04",
  },
  optionLetter: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#F0F0F0",
    alignItems: "center",
    justifyContent: "center",
  },
  optionLetterSelected: {
    backgroundColor: "#58CD04",
  },
  optionLetterText: {
    fontWeight: "900",
    fontSize: 13,
    lineHeight: 13,
    color: "#6B6B6B",
  },
  optionLetterTextSelected: {
    color: "#FFFFFF",
  },
  optionText: {
    fontWeight: "700",
    fontSize: 15,
    lineHeight: 22,
    color: "#2B2B2B",
  },
  optionTextSelected: {
    fontWeight: "900",
  },

  // ─── Bottom Bar ───────────────────────────────────────────────────────────
  bottomBar: {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderTopWidth: 1,
    borderTopColor: "#EFECEC",
  },
  bottomBarContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 16,
  },
  flagBtn: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: "rgba(240, 240, 240, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBtn: {
    flex: 1,
    height: 64,
    backgroundColor: "#58CD04",
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: "rgba(88, 205, 4, 0.2)",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 1,
    shadowRadius: 25,
    elevation: 8,
  },
  confirmBtnText: {
    fontWeight: "900",
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: "#FFFFFF",
  },
});
