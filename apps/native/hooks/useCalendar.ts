import { useQuery } from "@tanstack/react-query";

import { progressService } from "@/services/progress.service";

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function useCalendar(month?: string) {
  const m = month ?? currentMonth();
  return useQuery({
    queryKey: ["calendar", m],
    queryFn: () => progressService.getCalendar(m),
    staleTime: 5 * 60 * 1000,
  });
}
