import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { callOp, ApiError } from './api'
import { toast } from '@/stores/toast'

export function useOp<T>(
  name: string,
  input: unknown = {},
  options?: { enabled?: boolean; staleTime?: number; refetchInterval?: number },
) {
  return useQuery<T>({
    queryKey: [name, input],
    queryFn: () => callOp<T>(name, input),
    enabled: options?.enabled ?? true,
    staleTime: options?.staleTime ?? 15_000,
    refetchInterval: options?.refetchInterval,
    retry: (count, error) => {
      if (error instanceof ApiError && error.code !== 'NETWORK' && error.code !== 'INTERNAL') {
        return false
      }
      return count < 2
    },
  })
}

export function useOpMutation<TIn, TOut = unknown>(
  name: string,
  options?: {
    onSuccess?: (data: TOut, input: TIn) => void
    onError?: (error: Error) => void
    silent?: boolean
  },
) {
  const queryClient = useQueryClient()
  return useMutation<TOut, Error, TIn>({
    mutationFn: (input) => callOp<TOut>(name, input),
    onSuccess: (data, input) => {
      queryClient.invalidateQueries()
      options?.onSuccess?.(data, input)
    },
    onError: (error) => {
      if (!options?.silent) toast.error(error.message)
      options?.onError?.(error)
    },
  })
}
