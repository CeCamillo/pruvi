import { useQuery } from "@tanstack/react-query";

import { sessionService } from "@/services/session.service";

export function useLives() {
  return useQuery({
    queryKey: ["lives"],
    queryFn: sessionService.getLives,
    staleTime: 30 * 1000, // 30s — matches server Redis TTL
  });
}
