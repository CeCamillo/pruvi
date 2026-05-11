export type PushPayload = {
  title: string;
  body: string;
};

export function streakReminderPrimary(): PushPayload {
  return {
    title: "A Pruvi te esperou hoje 💛",
    body: "Ainda dá tempo — 5 minutos é o suficiente.",
  };
}

export function streakReminderLate(): PushPayload {
  return {
    title: "Seu streak está em risco",
    body: "Uma sessão rápida segura o ritmo.",
  };
}

export function streakMilestone(days: 7 | 30): PushPayload {
  return {
    title: `${days} dias de streak! 🔥`,
    body:
      days === 7
        ? "Uma semana firme. Tá pegando o jeito."
        : "Um mês. Isso é dedicação real.",
  };
}

export function masteryAchievement(subtopicName: string): PushPayload {
  return {
    title: "Quase mestre! ⭐",
    body: `Você está dominando ${subtopicName}.`,
  };
}
