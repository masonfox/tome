import { ReactElement, ReactNode } from 'react';
import { render, renderHook as originalRenderHook, RenderOptions, RenderHookOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Creates a new QueryClient instance configured for testing
 * - Disables retries to make tests fail fast
 * - Disables caching for predictable test behavior
 */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // Don't retry failed queries in tests
        gcTime: 0, // Don't cache query results in tests
      },
      mutations: {
        retry: false, // Don't retry failed mutations in tests
      },
    },
  });
}

interface AllTheProvidersProps {
  children: ReactNode;
  queryClient?: QueryClient;
}

/**
 * Wrapper component that provides all necessary providers for testing
 */
function AllTheProviders({ children, queryClient }: AllTheProvidersProps) {
  const client = queryClient || createTestQueryClient();
  
  return (
    <QueryClientProvider client={client}>
      {children}
    </QueryClientProvider>
  );
}

/**
 * Custom render function that wraps components with necessary providers
 * 
 * Usage:
 * ```tsx
 * import { renderWithQueryClient } from '../test-utils';
 * 
 * test('my test', () => {
 *   const { getByText } = renderWithQueryClient(<MyComponent />);
 *   // ... test assertions
 * });
 * ```
 */
export function renderWithQueryClient(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & { queryClient?: QueryClient }
) {
  const { queryClient, ...renderOptions } = options || {};
  
  return render(ui, {
    wrapper: ({ children }) => (
      <AllTheProviders queryClient={queryClient}>
        {children}
      </AllTheProviders>
    ),
    ...renderOptions,
  });
}

/**
 * Custom renderHook function that wraps hooks with necessary providers
 * 
 * Usage:
 * ```tsx
 * import { renderHook } from '../test-utils';
 * 
 * test('my hook test', () => {
 *   const { result } = renderHook(() => useMyHook());
 *   // ... test assertions
 * });
 * ```
 */
export function renderHook<Result, Props>(
  callback: (props: Props) => Result,
  options?: Omit<RenderHookOptions<Props>, 'wrapper'> & { queryClient?: QueryClient }
) {
  const { queryClient, ...renderOptions } = options || {};
  
  return originalRenderHook(callback, {
    wrapper: ({ children }) => (
      <AllTheProviders queryClient={queryClient}>
        {children}
      </AllTheProviders>
    ),
    ...renderOptions,
  });
}

// Re-export everything from @testing-library/react
export * from '@testing-library/react';

// Override render and renderHook with our custom versions
export { renderWithQueryClient as render };

