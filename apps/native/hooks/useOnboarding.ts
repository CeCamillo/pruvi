import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  OnboardingCompleteBody,
  UserPreferences,
} from "@pruvi/shared";

import { onboardingService } from "@/services/onboarding.service";

const PREFERENCES_KEY = ["preferences"] as const;

export function usePreferences() {
  return useQuery({
    queryKey: PREFERENCES_KEY,
    queryFn: onboardingService.getPreferences,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSavePreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: UserPreferences) =>
      onboardingService.updatePreferences(patch),
    onSuccess: (data) => {
      // Seed the cache with the server-authoritative snapshot so the
      // next render doesn't refetch just to learn what we already wrote.
      queryClient.setQueryData(PREFERENCES_KEY, data);
    },
  });
}

export function useCompleteOnboarding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: OnboardingCompleteBody) =>
      onboardingService.complete(payload),
    onSuccess: () => {
      // Force the preferences query to refetch so the auth guard sees
      // `onboardingCompleted: true` on the next render and routes the
      // user out of the onboarding stack.
      queryClient.invalidateQueries({ queryKey: PREFERENCES_KEY });
    },
  });
}
