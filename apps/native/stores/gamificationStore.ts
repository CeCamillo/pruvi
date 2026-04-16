import { create } from "zustand";

interface GamificationStore {
  pendingXP: number;
  streakAnimationTrigger: number;
  actions: {
    addXP: (amount: number) => void;
    triggerStreakAnimation: () => void;
    flush: () => void;
  };
}

export const useGamificationStore = create<GamificationStore>((set) => ({
  pendingXP: 0,
  streakAnimationTrigger: 0,
  actions: {
    addXP: (amount) => set((s) => ({ pendingXP: s.pendingXP + amount })),
    triggerStreakAnimation: () =>
      set((s) => ({ streakAnimationTrigger: s.streakAnimationTrigger + 1 })),
    flush: () => set({ pendingXP: 0, streakAnimationTrigger: 0 }),
  },
}));
