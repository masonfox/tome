import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ReadingGoal } from "@/lib/db/schema";
import { goalsApi } from "@/lib/api";

interface CreateGoalPayload {
  year: number;
  booksGoal: number;
}

interface UpdateGoalPayload {
  booksGoal: number;
}

/**
 * Hook for managing annual reading goals
 * 
 * Provides query and mutations for CRUD operations on reading goals
 */
export function useReadingGoals() {
  const queryClient = useQueryClient();

  // Query: Fetch all reading goals
  const { data: goals = [], isLoading, error } = useQuery({
    queryKey: ['reading-goals'],
    queryFn: async () => {
      const response = await goalsApi.list();
      return response.success ? response.data : [];
    },
    staleTime: 30000, // 30 seconds
  });

  // Mutation: Create new reading goal
  const createGoal = useMutation({
    mutationFn: async (payload: CreateGoalPayload) => {
      return goalsApi.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reading-goals'] });
      toast.success('Reading goal created!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Mutation: Update existing reading goal
  const updateGoal = useMutation({
    mutationFn: async (params: { id: number; data: UpdateGoalPayload }) => {
      return goalsApi.update(params.id, params.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reading-goals'] });
      toast.success('Reading goal updated!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Mutation: Delete reading goal
  const deleteGoal = useMutation({
    mutationFn: async (goalId: number) => {
      return goalsApi.delete(goalId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reading-goals'] });
      toast.success('Reading goal deleted!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return {
    goals,
    isLoading,
    error,
    createGoal: createGoal.mutate,
    createGoalAsync: createGoal.mutateAsync,
    updateGoal: updateGoal.mutate,
    updateGoalAsync: updateGoal.mutateAsync,
    deleteGoal: deleteGoal.mutate,
    deleteGoalAsync: deleteGoal.mutateAsync,
    isCreating: createGoal.isPending,
    isUpdating: updateGoal.isPending,
    isDeleting: deleteGoal.isPending,
  };
}
