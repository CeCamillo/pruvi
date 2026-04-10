import { useRouter } from "expo-router";

import { QuestionLayout } from "./components/question-layout";

const QUESTION = {
  number: 3,
  total: 5,
  exam: "ENEM",
  subject: "Linguagens",
  context:
    "O uso excessivo de estrangeirismos na língua portuguesa contemporânea tem sido objeto de diversos debates acadêmicos e sociais.",
  question:
    'A incorporação da palavra "feedback" no ambiente corporativo brasileiro exemplifica:',
  answers: [
    { letter: "A", text: "A dinâmica natural de evolução e contato entre línguas." },
    { letter: "B", text: "Uma ameaça direta à pureza gramatical do idioma nacional." },
    { letter: "C", text: "A carência de termos equivalentes na língua portuguesa." },
    { letter: "D", text: "Um processo de colonização cultural irreversível." },
  ],
};

export default function TestQuestion3Screen() {
  const router = useRouter();

  return (
    <QuestionLayout
      data={QUESTION}
      onSubmit={() => router.push("/(onboarding)/test-question-4")}
      onSkip={() => router.push("/(onboarding)/test-question-4")}
    />
  );
}
