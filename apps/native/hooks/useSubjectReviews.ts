import { useQuery } from "@tanstack/react-query";

import { progressService } from "@/services/progress.service";

export function useSubjectReviews(slug: string | undefined) {
  return useQuery({
    queryKey: ["subject-reviews", slug],
    queryFn: () => progressService.getSubjectReviews(slug!),
    enabled: !!slug,
    staleTime: 60 * 1000,
  });
}
