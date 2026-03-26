import { useRouter } from "expo-router";

import { QuestionLayout } from "./components/question-layout";

const QUESTION = {
  number: 4,
  total: 5,
  exam: "ENEM",
  subject: "Ciências da Natureza",
  context: "TODO — aguardando conteúdo do Figma.",
  question: "TODO",
  answers: [
    { letter: "A", text: "TODO" },
    { letter: "B", text: "TODO" },
    { letter: "C", text: "TODO" },
    { letter: "D", text: "TODO" },
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
