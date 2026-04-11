import { useLocalSearchParams, useRouter } from "expo-router";

import { RoletaResultScreen } from "./components/roleta-result";

// ─── Mock data for both states ───────────────────────────────────────────────

const SUCCESS_DATA = {
  isCorrect: true,
  questionText: "A membrana plasmática é uma estrutura essencial que delimita a célula e controla a entrada e saída de substâncias. Sobre o modelo do mosaico fluido, assinale a alternativa que descreve corretamente a organização das moléculas na membrana:",
  subject: "Biologia",
  tags: ["Biologia", "Citologia"],
  selectedLetter: "B",
  correctLetter: "A",
  xp: 15,
  time: "00:32 min",
  explanation: 'O modelo do mosaico fluido descreve a membrana como uma estrutura dinâmica. Os fosfolipídios bicamada fluida onde as proteínas e podem se mover lateralmente.',
  stats: [
    { label: "Alternativa A", value: "12%" },
    { label: "Alternativa B (Correta)", value: "70%", color: "#58CD04" },
    { label: "Alternativa C", value: "8%" },
    { label: "Alternativa D", value: "10%" },
  ],
};

const ERROR_DATA = {
  isCorrect: false,
  questionText: "A membrana plasmática é uma estrutura essencial que delimita a célula e controla a entrada e saída de substâncias.",
  subject: "Biologia",
  tags: ["Biologia", "Citologia"],
  selectedLetter: "A",
  correctLetter: "A",
  xp: 0,
  time: "00:45 min",
  tip: 'Dica: Foque em palavras-chave como "bicamada" e "fluido". Quase todas as questões sobre membrana cobram o conceito de movimento!',
  errorExplanation: "Você marcou uma camada única. Na realidade, os lipídios se organizam em duas camadas devido às suas caudas hidrofóbicas.",
  stats: [
    { label: "Alternativa A", value: "12%" },
    { label: "Alternativa B (Correta)", value: "70%", color: "#58CD04" },
    { label: "Alternativa C", value: "8%" },
    { label: "Alternativa D", value: "10%" },
  ],
};

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function RoletaResultScreenWrapper() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string }>();
  const isError = params.type === "error";
  const data = isError ? ERROR_DATA : SUCCESS_DATA;

  return (
    <RoletaResultScreen
      {...data}
      onNext={() => router.back()}
      onClose={() => router.back()}
    />
  );
}
