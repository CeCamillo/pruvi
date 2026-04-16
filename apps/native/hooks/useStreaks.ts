import { useQuery } from "@tanstack/react-query";

import { sessionService } from "@/services/session.service";

export function useStreaks() {
  return useQuery({
    queryKey: ["streaks"],
    queryFn: sessionService.getStreaks,
    // Inherits 5min default staleTime from QueryClient
  });
}
