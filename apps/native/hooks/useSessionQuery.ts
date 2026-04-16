import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { sessionService } from "@/services/session.service";

export function useTodaySession() {
  return useQuery({
    queryKey: ["session", "today"],
    queryFn: sessionService.getToday,
  });
}

export function useStartSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (mode: "all" | "theoretical") =>
      sessionService.startSession(mode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session", "today"] });
    },
  });
}

export function useAnswerQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { questionId: number; selectedOptionIndex: number }) =>
      sessionService.answerQuestion(vars.questionId, vars.selectedOptionIndex),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lives"] });
      queryClient.invalidateQueries({ queryKey: ["xp"] });
    },
  });
}

export function useCompleteSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      id: number;
      questionCount: number;
      correctCount: number;
    }) =>
      sessionService.completeSession(
        vars.id,
        vars.questionCount,
        vars.correctCount,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session", "today"] });
      queryClient.invalidateQueries({ queryKey: ["streaks"] });
      queryClient.invalidateQueries({ queryKey: ["xp"] });
    },
  });
}
