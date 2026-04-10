import { useRouter } from "expo-router";

import { QuestionLayout } from "./components/question-layout";

const QUESTION = {
  number: 5,
  total: 5,
  exam: "ENEM",
  subject: "História",
  context:
    "A Revolução Industrial, iniciada na Inglaterra no século XVIII, alterou profundamente as relações de trabalho e a organização social.",
  question: "Qual foi a principal consequência demográfica desse processo?",
  answers: [
    { letter: "A", text: "Intenso êxodo rural e urbanização acelerada." },
    { letter: "B", text: "Redução drástica da taxa de natalidade nas cidades." },
    { letter: "C", text: "Migração em massa da Europa para as colônias africanas." },
    { letter: "D", text: "Estagnação do crescimento populacional global." },
  ],
};

export default function TestQuestion5Screen() {
  const router = useRouter();

  return (
    <QuestionLayout
      data={QUESTION}
      submitLabel="CONCLUIR TESTE"
      skipLabel="FINALIZAR"
      onSubmit={() => router.push("/(drawer)")}
      onSkip={() => router.push("/(drawer)")}
    />
  );
}
