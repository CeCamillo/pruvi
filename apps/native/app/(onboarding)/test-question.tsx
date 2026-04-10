import { useRouter } from "expo-router";

import { QuestionLayout } from "./components/question-layout";

const QUESTION = {
  number: 1,
  total: 5,
  exam: "ENEM",
  subject: "Geografia",
  context:
    "No Brasil, a baixa incidência de terremotos de grande magnitude é explicada principalmente pela localização do território nacional.",
  question: "Qual fator geológico justifica essa estabilidade?",
  answers: [
    { letter: "A", text: "Presença de cadeias montanhosas recentes." },
    { letter: "B", text: "Localização no centro de uma placa tectônica." },
    { letter: "C", text: "Ausência de vulcões ativos no território." },
    { letter: "D", text: "Estrutura de dobramentos antigos." },
  ],
};

export default function TestQuestionScreen() {
  const router = useRouter();

  return (
    <QuestionLayout
      data={QUESTION}
      onSubmit={() => router.push("/(onboarding)/test-question-2")}
      onSkip={() => router.push("/(onboarding)/test-question-2")}
    />
  );
}
