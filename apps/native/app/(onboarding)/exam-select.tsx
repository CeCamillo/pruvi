import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import { ExamCard } from "./components/exam-card";
import { OnboardingHeader } from "./components/onboarding-header";
import { PrimaryButton } from "./components/primary-button";

// --- Exam Icons (inline SVG) ---

function EnemIcon() {
  return (
    <Svg width={24} height={24} viewBox="10 10 24 24" fill="none">
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M18.387 15.08a8.35 8.35 0 013.613-2.08 8.36 8.36 0 013.608 4c-.015.09-.037.19-.066.303a4.1 4.1 0 01-.413 1.002c-.05.077-.25.273-.613.544-.162.12-.341.231-.556.36l-.074.043a9.4 9.4 0 00-.609.382c-.488.334-.996.786-1.338 1.517a2.16 2.16 0 00-.12 1.456c.035.135.054.27.055.39 0 .037-.015.096-.097.165a.42.42 0 01-.327.118c-1.077-.012-1.927-.904-2.05-2.327-.094-1.082-.536-2.084-1.013-2.874"
        fill="#84CC16"
      />
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M26.652 24.509c.264-.003.512-.02.745-.05a8.98 8.98 0 01-3.418 2.257c-.046-.381-.016-.84.209-1.263.192-.362.678-.633 1.334-.794a6.6 6.6 0 011.109-.15h.021z"
        fill="#84CC16"
      />
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M15 20c0-1.72.62-3.294 1.648-4.512.103.143.203.297.301.46.402.664.713 1.416.777 2.15.17 1.97 1.481 3.837 3.705 3.862.961.01 2.126-.712 2.123-1.968 0-.287-.046-.567-.112-.815a.35.35 0 01.019-.315c.17-.364.422-.607.766-.842.16-.11.326-.21.518-.324l.077-.046c.216-.129.461-.278.698-.454.345-.257.79-.618 1.027-.99.187-.294.36-.671.494-1.063A9.01 9.01 0 0129 20c-.001.533-.059 1.05-.172 1.55-.066.21-.169.407-.303.582-.237.307-.712.685-1.89.697h-.036l-.096.003a6.4 6.4 0 00-1.382.195c-.759.186-1.871.61-2.417 1.639-.43.811-.48 1.645-.382 2.327A9.01 9.01 0 0115 20z"
        fill="#84CC16"
      />
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M27.995 11.31a.75.75 0 011.06-.06A10.75 10.75 0 0132.75 19.512c0 5.762-4.397 10.498-10.019 11.034v.551h1.252a.75.75 0 010 1.503h-4.007a.75.75 0 010-1.503h1.252v-.51a10.72 10.72 0 01-7.824-4.185.75.75 0 011.12-1.002 9.23 9.23 0 007.142 3.193c5.291 0 9.581-4.29 9.581-9.581a9.25 9.25 0 00-3.194-7.142.75.75 0 01-.06-1.061"
        fill="#84CC16"
      />
    </Svg>
  );
}

function FuvestIcon() {
  return (
    <Svg width={24} height={24} viewBox="10 10 24 24" fill="none">
      <Path
        d="M12 32c0-1.415 0-2.122.44-2.56C12.879 29 13.585 29 15 29s2.122 0 2.56.44C18 29.879 18 30.586 18 32V23c0-1.415 0-2.122.44-2.56C18.879 20 19.586 20 21 20h2c1.415 0 2.122 0 2.56.44.44.439.44 1.146.44 2.56v9 -3c0-1.415 0-2.122.44-2.56.439-.44 1.145-.44 2.56-.44s2.122 0 2.56.44c.44.439.44 1.146.44 2.56v3"
        stroke="#6B6B6B"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M21.141 13.029c.382-.687.573-1.029.859-1.029s.477.342.859 1.029l.099.177a.88.88 0 00.247.356.88.88 0 00.403.136l.19.044c.743.168 1.114.252 1.203.536.088.283-.165.58-.671 1.171l-.131.153a.88.88 0 00-.248.346.88.88 0 00.001.44l.02.205c.076.79.115 1.185-.116 1.36-.231.176-.58.015-1.275-.304l-.18-.083a.88.88 0 00-.402-.137.88.88 0 00-.401.137l-.18.083c-.695.319-1.043.48-1.274.304-.231-.175-.192-.57-.116-1.36l.02-.204a.88.88 0 00.001-.44.88.88 0 00-.248-.347l-.131-.153c-.506-.59-.76-.888-.671-1.171.088-.284.459-.368 1.202-.536l.191-.044a.88.88 0 00.403-.136.88.88 0 00.247-.356l.098-.177z"
        stroke="#6B6B6B"
        strokeWidth={1.509}
      />
    </Svg>
  );
}

function UnicampIcon() {
  return (
    <Svg width={24} height={24} viewBox="10 10 24 24" fill="none">
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M14.221 22c0-4.971 4-9 9-9s9 4.029 9 9-4.029 9-9 9-9-4.029-9-9z"
        stroke="#6B6B6B"
        strokeWidth={1.5}
      />
      <Path
        d="M23.221 18v4l2.5 2.5"
        stroke="#6B6B6B"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M12 22h3M12 18h2M12 26h2" stroke="#6B6B6B" strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

// --- Search Icon ---

function SearchIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M1.667 9.583a7.917 7.917 0 1115.833 0 7.917 7.917 0 01-15.833 0z"
        stroke="#6B6B6B"
        strokeWidth={1.25}
      />
      <Path d="M15.417 15.417l2.916 2.916" stroke="#6B6B6B" strokeWidth={1.25} strokeLinecap="round" />
    </Svg>
  );
}

// --- Exam data ---

const EXAMS = [
  { id: "enem", title: "ENEM 2024", subtitle: "Exame Nacional", icon: <EnemIcon /> },
  { id: "fuvest", title: "FUVEST (USP)", subtitle: "Estadual São Paulo", icon: <FuvestIcon /> },
  { id: "unicamp", title: "UNICAMP", subtitle: "Estadual Campinas", icon: <UnicampIcon /> },
] as const;

export default function ExamSelectScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<Set<string>>(new Set(["enem"]));

  function toggleExam(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <View style={styles.screen}>
      <OnboardingHeader step={1} totalSteps={6} title="Objetivos" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>QUAL VESTIBULAR VOCÊ QUER CONQUISTAR?</Text>
          <Text style={styles.subtitle}>
            Selecione uma ou mais opções. Vamos adaptar sua jornada aos seus objetivos reais.
          </Text>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <SearchIcon />
          <Text style={styles.searchPlaceholder}>Pesquise por instituição ou curso...</Text>
        </View>

        {/* Exam Cards */}
        <View style={styles.cardsSection}>
          {EXAMS.map((exam) => (
            <ExamCard
              key={exam.id}
              icon={exam.icon}
              title={exam.title}
              subtitle={exam.subtitle}
              selected={selected.has(exam.id)}
              onPress={() => toggleExam(exam.id)}
            />
          ))}
        </View>
      </ScrollView>

      {/* Bottom Section */}
      <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.hintRow}>
          <View style={styles.hintDot} />
          <Text style={styles.hintText}>Escolha seus focos para continuarmos.</Text>
        </View>
        <View style={styles.buttonWrapper}>
          <PrimaryButton label="PRÓXIMO" onPress={() => router.push("/(drawer)")} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FAFBFC",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 32,
    paddingBottom: 24,
  },

  // Title
  titleSection: {
    marginTop: 24,
    gap: 12,
  },
  title: {
    fontWeight: "900",
    fontSize: 28,
    lineHeight: 31,
    letterSpacing: -0.7,
    textTransform: "uppercase",
    color: "#2B2B2B",
  },
  subtitle: {
    fontWeight: "700",
    fontSize: 14,
    lineHeight: 23,
    color: "rgba(107, 107, 107, 0.7)",
  },

  // Search
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    height: 64,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "rgba(239, 236, 236, 0.4)",
    paddingHorizontal: 20,
    gap: 16,
    marginTop: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  searchPlaceholder: {
    fontWeight: "700",
    fontSize: 15,
    lineHeight: 22,
    color: "#2B2B2B",
    opacity: 0.4,
  },

  // Cards
  cardsSection: {
    marginTop: 32,
    gap: 12,
  },

  // Bottom
  bottomSection: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 32,
    paddingTop: 33,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(239, 236, 236, 0.4)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.03,
    shadowRadius: 40,
    elevation: 4,
  },
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  hintDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#84CC16",
  },
  hintText: {
    fontWeight: "700",
    fontSize: 13,
    lineHeight: 20,
    color: "rgba(107, 107, 107, 0.8)",
  },
  buttonWrapper: {
    marginTop: 24,
  },
});
