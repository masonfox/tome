import { vi } from 'vitest';
import { baseApiClient } from '@/lib/api/base-client';

/**
 * Spy on baseApiClient methods for domain API testing
 *
 * Returns spies for get, post, patch, delete methods.
 * Call restoreAll() after tests to clean up.
 *
 * @example
 * const spies = spyOnBaseApiClient();
 * spies.get.mockResolvedValue({ data: 'test' });
 * await bookApi.getDetail('123');
 * expect(spies.get).toHaveBeenCalledWith('/api/books/123');
 * spies.restoreAll();
 */
export function spyOnBaseApiClient() {
  const getSpy = vi.spyOn(baseApiClient as any, 'get');
  const postSpy = vi.spyOn(baseApiClient as any, 'post');
  const patchSpy = vi.spyOn(baseApiClient as any, 'patch');
  const deleteSpy = vi.spyOn(baseApiClient as any, 'delete');

  return {
    get: getSpy,
    post: postSpy,
    patch: patchSpy,
    delete: deleteSpy,
    restoreAll: () => {
      getSpy.mockRestore();
      postSpy.mockRestore();
      patchSpy.mockRestore();
      deleteSpy.mockRestore();
    },
  };
}
