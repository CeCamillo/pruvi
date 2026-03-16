import type { Result } from "neverthrow";

/** Standard API success response */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

/** Standard API error response */
export interface ApiErrorResponse {
  success: false;
  error: string;
  code: string;
}

/** Union type for all API responses */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/** Helper to create success responses */
export function successResponse<T>(data: T): ApiSuccessResponse<T> {
  return { success: true, data };
}

/**
 * Unwrap a neverthrow Result into an API response.
 * Ok values become { success: true, data }.
 * Err values throw the AppError (caught by errorHandlerPlugin).
 */
export function unwrapResult<T, E extends Error>(
  result: Result<T, E>
): ApiSuccessResponse<T> {
  if (result.isOk()) {
    return successResponse(result.value);
  }
  throw result.error;
}
