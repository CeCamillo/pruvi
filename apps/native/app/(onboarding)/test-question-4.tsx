import { useRouter } from "expo-router";

import { QuestionLayout } from "./components/question-layout";

const QUESTION = {
  number: 4,
  total: 5,
  exam: "ENEM",
  subject: "Biologia",
  context:
    "A fotossíntese é o processo fundamental pelo qual as plantas transformam energia luminosa em energia química, produzindo matéria orgânica.",
  question:
    "Qual é o principal subproduto liberado para a atmosfera durante a fase clara desse processo?",
  answers: [
    { letter: "A", text: "Glicose (C₆H₁₂O₆)" },
    { letter: "B", text: "Dióxido de Carbono (CO₂)" },
    { letter: "C", text: "Oxigênio (O₂)" },
    { letter: "D", text: "Vapor de Água (H₂O)" },
  ],
};

export default function TestQuestion4Screen() {
  const router = useRouter();

  return (
    <QuestionLayout
      data={QUESTION}
      onSubmit={() => router.push("/(onboarding)/test-question-5")}
      onSkip={() => router.push("/(onboarding)/test-question-5")}
    />
  );
}
