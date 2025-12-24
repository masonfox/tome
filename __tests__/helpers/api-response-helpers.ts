/**
 * Test helper utilities for working with standardized API responses
 */

/**
 * Extract data from standardized success response
 * Handles both old format (direct data) and new format ({ success: true, data: ... })
 */
export function extractResponseData<T>(responseData: any): T {
  // New format with success wrapper
  if (responseData && typeof responseData === 'object' && 'success' in responseData) {
    if (responseData.success === true) {
      return responseData.data as T;
    }
  }
  
  // Old format - data returned directly
  return responseData as T;
}

/**
 * Extract error from standardized error response
 * Handles both old format ({ error: "message" }) and new format ({ success: false, error: { code, message } })
 */
export function extractResponseError(responseData: any): { code?: string; message: string; errorId?: string } {
  // New format with success wrapper and structured error
  if (responseData && typeof responseData === 'object' && 'success' in responseData) {
    if (responseData.success === false && responseData.error) {
      return {
        code: responseData.error.code,
        message: responseData.error.message,
        errorId: responseData.error.errorId,
      };
    }
  }
  
  // Old format - direct error message
  if (responseData && typeof responseData === 'object' && 'error' in responseData) {
    return {
      message: responseData.error as string,
    };
  }
  
  return { message: 'Unknown error' };
}

/**
 * Check if response is a success response
 */
export function isSuccessResponse(responseData: any): boolean {
  if (responseData && typeof responseData === 'object' && 'success' in responseData) {
    return responseData.success === true;
  }
  // Old format without success field is assumed to be success if no error field
  return !('error' in responseData);
}

/**
 * Check if response is an error response
 */
export function isErrorResponse(responseData: any): boolean {
  if (responseData && typeof responseData === 'object' && 'success' in responseData) {
    return responseData.success === false;
  }
  // Old format with error field
  return responseData && typeof responseData === 'object' && 'error' in responseData;
}
