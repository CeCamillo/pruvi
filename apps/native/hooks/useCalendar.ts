import { useQuery } from "@tanstack/react-query";

import { currentMonth } from "@/lib/date-format";
import { progressService } from "@/services/progress.service";

// 30 minutes. The server caches this key with setUntilMidnight (up to
// ~23h), so there's no point refetching every few minutes — mutations
// (useCompleteSession) already invalidate the key on real changes.
const CALENDAR_STALE_TIME = 30 * 60 * 1000;

export function useCalendar(month?: string) {
  const m = month ?? currentMonth();
  return useQuery({
    queryKey: ["calendar", m],
    queryFn: () => progressService.getCalendar(m),
    staleTime: CALENDAR_STALE_TIME,
  });
}
