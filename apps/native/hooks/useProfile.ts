import { useLives } from "@/hooks/useLives";
import { useStreaks } from "@/hooks/useStreaks";
import { useXp } from "@/hooks/useXp";

/**
 * Composed hook that aggregates XP, streaks, and lives for the profile screen.
 * Returns a flat object instead of nested query results for ergonomic consumption.
 */
export function useProfile() {
  const xp = useXp();
  const streaks = useStreaks();
  const lives = useLives();

  return {
    xp: xp.data,
    streaks: streaks.data,
    lives: lives.data,
    isLoading: xp.isLoading || streaks.isLoading || lives.isLoading,
    isError: xp.isError || streaks.isError || lives.isError,
  };
}
