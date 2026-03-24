import { useRouter } from "expo-router";

import { QuestionLayout } from "./components/question-layout";

const QUESTION = {
  number: 2,
  total: 5,
  exam: "ENEM",
  subject: "Matemática",
  context:
    "Em uma pesquisa de mercado, observou-se que o crescimento das vendas de um novo produto segue uma função logarítmica.",
  question: "Se f(x) = log(x + 4), qual o valor de x para que f(x) seja igual a 5?",
  answers: [
    { letter: "A", text: "26" },
    { letter: "B", text: "28" },
    { letter: "C", text: "32" },
    { letter: "D", text: "36" },
  ],
};

export default function TestQuestion2Screen() {
  const router = useRouter();

  return (
    <QuestionLayout
      data={QUESTION}
      onSubmit={() => router.push("/(drawer)")}
      onSkip={() => router.push("/(drawer)")}
    />
  );
}
