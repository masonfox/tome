import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

/**
 * Custom hook for managing streak operations
 * Provides mutations for rebuilding streak, updating daily threshold, and changing timezone
 */
export function useStreak() {
  const queryClient = useQueryClient();

  // Mutation for rebuilding streak from reading history
  const rebuildMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/streak/rebuild", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to recalculate streak");
      }

      return data;
    },
    onSuccess: () => {
      // Invalidate all streak-related queries
      queryClient.invalidateQueries({ queryKey: ['streak-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['streaks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success("Streak recalculated successfully!");
    },
    onError: (error) => {
      console.error("Failed to recalculate streak:", error);
      toast.error("Failed to recalculate streak. Please try again.");
    },
  });

  // Mutation for updating daily threshold
  const updateThresholdMutation = useMutation({
    mutationFn: async (dailyThreshold: number) => {
      const response = await fetch("/api/streak", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyThreshold }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to update goal");
      }

      return data;
    },
    onSuccess: () => {
      // Invalidate streak-related queries
      queryClient.invalidateQueries({ queryKey: ['streak-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['streaks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success("Daily reading goal updated!");
    },
    onError: (error: any) => {
      console.error("Failed to update daily goal:", error);
      toast.error(error.message || "Failed to update daily reading goal");
    },
  });

  // Mutation for updating timezone
  const updateTimezoneMutation = useMutation({
    mutationFn: async (timezone: string) => {
      const response = await fetch("/api/streak/timezone", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to update timezone");
      }

      return data;
    },
    onSuccess: () => {
      // Invalidate all queries since timezone affects date boundaries
      queryClient.invalidateQueries({ queryKey: ['streak-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['streaks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] }); // Stats page also uses timezone
      toast.success("Timezone updated! Streak recalculated with new day boundaries.");
    },
    onError: (error: any) => {
      console.error("Failed to update timezone:", error);
      toast.error(error.message || "Failed to update timezone");
    },
  });

  return {
    // Rebuild operations
    rebuildStreak: rebuildMutation.mutate,
    rebuildStreakAsync: rebuildMutation.mutateAsync,
    isRebuilding: rebuildMutation.isPending,
    
    // Threshold operations
    updateThreshold: updateThresholdMutation.mutate,
    updateThresholdAsync: updateThresholdMutation.mutateAsync,
    isUpdatingThreshold: updateThresholdMutation.isPending,
    
    // Timezone operations
    updateTimezone: updateTimezoneMutation.mutate,
    updateTimezoneAsync: updateTimezoneMutation.mutateAsync,
    isUpdatingTimezone: updateTimezoneMutation.isPending,
  };
}
