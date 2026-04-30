import { useQuery } from "@tanstack/react-query";

import { meService } from "@/services/me.service";

export function useMe() {
  return useQuery({
    queryKey: ["me"] as const,
    queryFn: meService.getMe,
    staleTime: 60 * 1000, // matches server cache TTL
  });
}
