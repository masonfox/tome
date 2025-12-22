import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ReadingGoal } from "@/lib/db/schema";

interface CreateGoalPayload {
  year: number;
  targetBooks: number;
}

interface UpdateGoalPayload {
  targetBooks: number;
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
      const response = await fetch('/api/reading-goals');
      if (!response.ok) {
        throw new Error('Failed to fetch reading goals');
      }
      const data = await response.json();
      return data.success ? data.data as ReadingGoal[] : [];
    },
    staleTime: 30000, // 30 seconds
  });

  // Mutation: Create new reading goal
  const createGoal = useMutation({
    mutationFn: async (payload: CreateGoalPayload) => {
      const response = await fetch('/api/reading-goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create reading goal');
      }

      return response.json();
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
      const response = await fetch(`/api/reading-goals/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params.data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update reading goal');
      }

      return response.json();
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
      const response = await fetch(`/api/reading-goals/${goalId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete reading goal');
      }

      return response.json();
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
