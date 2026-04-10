import { useRouter } from "expo-router";
import { useState } from "react";

import {
  RoletaQuestionScreen,
  type RoletaQuestionData,
} from "./components/roleta-question";

// ─── Mock Data ───────────────────────────────────────────────────────────────

const MOCK_QUESTIONS: RoletaQuestionData[] = [
  {
    id: "q1",
    subject: "Biologia",
    tags: ["Biologia", "Citologia", "Membrana"],
    text: "A membrana plasmática é uma estrutura essencial que delimita a célula e controla a entrada e saída de substâncias. Sobre o modelo do mosaico fluido, assinale a alternativa que descreve corretamente a organização das moléculas na membrana:",
    options: [
      { letter: "A", text: "Camada única de proteínas intercalada por carboidratos fixos" },
      { letter: "B", text: "Bicamada lipídica com proteínas que podem se deslocar lateralmente." },
      { letter: "C", text: "Parede rígida formada exclusivamente por polissacarídeos fibrosos" },
      { letter: "D", text: "Estrutura estática composta por uma rede de microtúbulos externos." },
    ],
  },
  {
    id: "q2",
    subject: "Biologia",
    tags: ["Biologia", "Genética", "DNA"],
    text: "No processo de replicação do DNA, qual enzima é responsável por desenrolar a dupla hélice e separar as fitas de DNA?",
    options: [
      { letter: "A", text: "Helicase" },
      { letter: "B", text: "DNA Polimerase" },
      { letter: "C", text: "Ligase" },
      { letter: "D", text: "Primase" },
    ],
  },
  {
    id: "q3",
    subject: "Biologia",
    tags: ["Biologia", "Ecologia", "Cadeia Alimentar"],
    text: "Em uma cadeia alimentar, os organismos que ocupam o primeiro nível trófico e são capazes de produzir sua própria matéria orgânica são chamados de:",
    options: [
      { letter: "A", text: "Consumidores Primários" },
      { letter: "B", text: "Decompositores" },
      { letter: "C", text: "Produtores" },
      { letter: "D", text: "Consumidores Secundários" },
    ],
  },
];

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function RoletaQuizScreen() {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});

  return (
    <RoletaQuestionScreen
      questions={MOCK_QUESTIONS}
      currentIndex={currentIndex}
      selectedAnswers={selectedAnswers}
      onSelectAnswer={(questionId, letter) => {
        setSelectedAnswers((prev) => ({ ...prev, [questionId]: letter }));
      }}
      onNext={() => {
        if (currentIndex < MOCK_QUESTIONS.length - 1) {
          setCurrentIndex((i) => i + 1);
        }
      }}
      onPrevious={() => {
        if (currentIndex > 0) {
          setCurrentIndex((i) => i - 1);
        }
      }}
      onSubmit={() => {
        router.push("/(drawer)/roleta-result" as any);
      }}
      onClose={() => router.back()}
    />
  );
}
