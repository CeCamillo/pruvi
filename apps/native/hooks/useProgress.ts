import { useQuery } from "@tanstack/react-query";

import { progressService } from "@/services/progress.service";

export function useProgress() {
  return useQuery({
    queryKey: ["progress"],
    queryFn: progressService.getProgress,
    staleTime: 60 * 1000,
  });
}
