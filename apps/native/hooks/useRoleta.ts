import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { RoletaAnswerBody, RoletaConfig } from "@pruvi/shared";

import { roletaService } from "@/services/roleta.service";

const CONFIG_KEY = ["roleta", "config"] as const;

export function useRoletaConfig(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: CONFIG_KEY,
    queryFn: roletaService.getConfig,
    staleTime: 5 * 60 * 1000,
    enabled: options?.enabled ?? true,
  });
}

export function useSaveRoletaConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: RoletaConfig) => roletaService.saveConfig(payload),
    onSuccess: (data) => {
      queryClient.setQueryData(CONFIG_KEY, data);
    },
  });
}

export function useSpinRoleta() {
  return useMutation({
    mutationFn: () => roletaService.spin(),
  });
}

export function useAnswerRoleta() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: RoletaAnswerBody) => roletaService.answer(payload),
    onSuccess: () => {
      // XP + progress displays on other screens go stale after each answer.
      queryClient.invalidateQueries({ queryKey: ["xp"] });
      queryClient.invalidateQueries({ queryKey: ["progress"] });
    },
  });
}
