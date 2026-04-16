import { useQuery } from "@tanstack/react-query";

import { sessionService } from "@/services/session.service";

export function useXp() {
  return useQuery({
    queryKey: ["xp"],
    queryFn: sessionService.getXp,
    staleTime: 60 * 1000, // 60s — matches server Redis TTL
  });
}
