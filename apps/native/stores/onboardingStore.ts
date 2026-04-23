import type {
  DailyStudyTime,
  Exam,
  PrepTimeline,
  StudyDifficulty,
} from "@pruvi/shared";
import { create } from "zustand";

/**
 * In-flight onboarding answers. Lives only in memory — we persist to the
 * backend once the user hits "finish" on the last step. If the app is
 * killed mid-flow, the next launch starts over (acceptable: 4 screens).
 */
interface OnboardingStore {
  selectedExam: Exam | null;
  prepTimeline: PrepTimeline | null;
  difficulties: StudyDifficulty[];
  dailyStudyTime: DailyStudyTime | null;
  actions: {
    setExam: (exam: Exam) => void;
    setPrepTimeline: (t: PrepTimeline) => void;
    setDifficulties: (d: StudyDifficulty[]) => void;
    setDailyStudyTime: (t: DailyStudyTime) => void;
    reset: () => void;
  };
}

const INITIAL_STATE = {
  selectedExam: null,
  prepTimeline: null,
  difficulties: [] as StudyDifficulty[],
  dailyStudyTime: null,
};

export const useOnboardingStore = create<OnboardingStore>((set) => ({
  ...INITIAL_STATE,
  actions: {
    setExam: (exam) => set({ selectedExam: exam }),
    setPrepTimeline: (t) => set({ prepTimeline: t }),
    setDifficulties: (d) => set({ difficulties: d }),
    setDailyStudyTime: (t) => set({ dailyStudyTime: t }),
    reset: () => set(INITIAL_STATE),
  },
}));

export const useOnboardingActions = () =>
  useOnboardingStore((s) => s.actions);
