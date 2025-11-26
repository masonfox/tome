# API Contracts: Reading Streak Tracking Enhancement

**Date**: 2025-11-25
**Feature**: Reading Streak Tracking Enhancement
**Base URL**: `/api/streak`

## Overview

This document defines the HTTP API contracts for streak tracking operations. All endpoints follow REST conventions and return JSON responses.

## Authentication

All endpoints inherit existing Tome authentication. No authentication changes required for this feature.

## Common Response Formats

### Success Response
```typescript
{
  success: true,
  data: T  // Type-specific payload
}
```

### Error Response
```typescript
{
  success: false,
  error: {
    code: string,      // Machine-readable error code
    message: string,   // Human-readable error message
    details?: any      // Optional additional context
  }
}
```

## Endpoints

### 1. Get Current Streak

**GET** `/api/streak`

Retrieves the current user's streak data including threshold configuration.

**Request**:
```http
GET /api/streak HTTP/1.1
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": 1,
    "currentStreak": 5,
    "longestStreak": 12,
    "dailyThreshold": 10,
    "lastActivityDate": "2025-11-25T08:00:00.000Z",
    "streakStartDate": "2025-11-21T08:00:00.000Z",
    "totalDaysActive": 45,
    "hoursRemainingToday": 16
  }
}
```

**Response Fields**:
- `id`: Streak record identifier
- `currentStreak`: Current consecutive days meeting threshold
- `longestStreak`: All-time best streak
- `dailyThreshold`: Pages required per day (1-9999)
- `lastActivityDate`: ISO 8601 timestamp of last reading activity
- `streakStartDate`: ISO 8601 timestamp when current streak began
- `totalDaysActive`: Total unique days with reading activity
- `hoursRemainingToday`: Hours until midnight in user's timezone

**Error Responses**:
- `404 Not Found`: No streak record exists for user
  ```json
  {
    "success": false,
    "error": {
      "code": "STREAK_NOT_FOUND",
      "message": "No streak record found for user"
    }
  }
  ```

---

### 2. Update Daily Threshold

**PATCH** `/api/streak/threshold`

Updates the user's daily reading threshold.

**Request**:
```http
PATCH /api/streak/threshold HTTP/1.1
Content-Type: application/json

{
  "dailyThreshold": 20
}
```

**Request Body**:
```typescript
{
  dailyThreshold: number  // Required: 1-9999 (inclusive)
}
```

**Validation Rules**:
- `dailyThreshold` must be an integer
- `dailyThreshold` must be between 1 and 9999 (inclusive)
- Request body must be valid JSON

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": 1,
    "currentStreak": 5,
    "longestStreak": 12,
    "dailyThreshold": 20,
    "lastActivityDate": "2025-11-25T08:00:00.000Z",
    "streakStartDate": "2025-11-21T08:00:00.000Z",
    "totalDaysActive": 45,
    "updatedAt": "2025-11-25T14:30:00.000Z"
  }
}
```

**Error Responses**:

- `400 Bad Request`: Invalid threshold value
  ```json
  {
    "success": false,
    "error": {
      "code": "INVALID_THRESHOLD",
      "message": "Daily threshold must be between 1 and 9999",
      "details": {
        "provided": 10000,
        "min": 1,
        "max": 9999
      }
    }
  }
  ```

- `400 Bad Request`: Missing required field
  ```json
  {
    "success": false,
    "error": {
      "code": "MISSING_FIELD",
      "message": "dailyThreshold is required"
    }
  }
  ```

- `400 Bad Request`: Invalid data type
  ```json
  {
    "success": false,
    "error": {
      "code": "INVALID_TYPE",
      "message": "dailyThreshold must be a number",
      "details": {
        "provided": "abc",
        "expected": "number"
      }
    }
  }
  ```

- `404 Not Found`: No streak record exists
  ```json
  {
    "success": false,
    "error": {
      "code": "STREAK_NOT_FOUND",
      "message": "No streak record found for user"
    }
  }
  ```

---

### 3. Get Streak Analytics

**GET** `/api/streak/analytics`

Retrieves detailed streak analytics including historical daily reading data.

**Request**:
```http
GET /api/streak/analytics?days=365 HTTP/1.1
```

**Query Parameters**:
- `days` (optional): Number of days of history to return
  - Default: 365
  - Range: 1-365
  - Type: integer

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "streak": {
      "currentStreak": 5,
      "longestStreak": 12,
      "dailyThreshold": 10,
      "totalDaysActive": 45
    },
    "dailyReadingHistory": [
      {
        "date": "2024-11-26",
        "pagesRead": 15,
        "thresholdMet": true
      },
      {
        "date": "2024-11-27",
        "pagesRead": 8,
        "thresholdMet": false
      }
    ],
    "booksAheadOrBehind": 2
  }
}
```

**Response Fields**:
- `streak`: Current streak statistics
  - `currentStreak`: Current consecutive days
  - `longestStreak`: All-time best
  - `dailyThreshold`: Current threshold
  - `totalDaysActive`: Total days with reading
- `dailyReadingHistory`: Array of daily reading records (ordered by date ASC)
  - `date`: YYYY-MM-DD format
  - `pagesRead`: Total pages read that day
  - `thresholdMet`: Boolean indicating if threshold was met
- `booksAheadOrBehind`: Number of books ahead (+) or behind (-) annual goal
  - Optional field: only present if user has reading goal configured
  - Positive = ahead of pace
  - Negative = behind pace
  - Zero = exactly on pace

**Error Responses**:

- `400 Bad Request`: Invalid days parameter
  ```json
  {
    "success": false,
    "error": {
      "code": "INVALID_PARAMETER",
      "message": "days parameter must be between 1 and 365",
      "details": {
        "provided": 400,
        "min": 1,
        "max": 365
      }
    }
  }
  ```

- `404 Not Found`: No streak record exists
  ```json
  {
    "success": false,
    "error": {
      "code": "STREAK_NOT_FOUND",
      "message": "No streak record found for user"
    }
  }
  ```

---

## Type Definitions

### TypeScript Interfaces

```typescript
// Streak entity
interface Streak {
  id: number;
  userId: number | null;
  currentStreak: number;
  longestStreak: number;
  dailyThreshold: number;
  lastActivityDate: Date;
  streakStartDate: Date;
  totalDaysActive: number;
  updatedAt: Date;
}

// Streak summary (for GET /api/streak)
interface StreakSummary {
  id: number;
  currentStreak: number;
  longestStreak: number;
  dailyThreshold: number;
  lastActivityDate: string;  // ISO 8601
  streakStartDate: string;    // ISO 8601
  totalDaysActive: number;
  hoursRemainingToday: number;
}

// Daily reading record
interface DailyReading {
  date: string;         // YYYY-MM-DD
  pagesRead: number;
  thresholdMet: boolean;
}

// Analytics response
interface StreakAnalytics {
  streak: {
    currentStreak: number;
    longestStreak: number;
    dailyThreshold: number;
    totalDaysActive: number;
  };
  dailyReadingHistory: DailyReading[];
  booksAheadOrBehind?: number;
}

// API response wrapper
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

// Update threshold request
interface UpdateThresholdRequest {
  dailyThreshold: number;
}
```

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `STREAK_NOT_FOUND` | 404 | No streak record exists for user |
| `INVALID_THRESHOLD` | 400 | Threshold value out of range (1-9999) |
| `INVALID_TYPE` | 400 | Field has wrong data type |
| `MISSING_FIELD` | 400 | Required field not provided |
| `INVALID_PARAMETER` | 400 | Query parameter out of valid range |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

## Rate Limiting

No specific rate limits for streak endpoints. Inherits any global API rate limiting configured for Tome.

## Caching

- **GET /api/streak**: No caching (always return fresh data)
- **GET /api/streak/analytics**: Can be cached client-side for 5 minutes
- **PATCH /api/streak/threshold**: Invalidates any cached streak data

## Examples

### Example 1: Fetching Current Streak

```bash
curl -X GET http://localhost:3000/api/streak \
  -H "Cookie: auth-token=..." \
  -H "Accept: application/json"
```

Response:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "currentStreak": 7,
    "longestStreak": 15,
    "dailyThreshold": 10,
    "lastActivityDate": "2025-11-25T08:00:00.000Z",
    "streakStartDate": "2025-11-19T08:00:00.000Z",
    "totalDaysActive": 50,
    "hoursRemainingToday": 12
  }
}
```

### Example 2: Updating Threshold

```bash
curl -X PATCH http://localhost:3000/api/streak/threshold \
  -H "Cookie: auth-token=..." \
  -H "Content-Type: application/json" \
  -d '{"dailyThreshold": 15}'
```

Response:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "currentStreak": 7,
    "longestStreak": 15,
    "dailyThreshold": 15,
    "lastActivityDate": "2025-11-25T08:00:00.000Z",
    "streakStartDate": "2025-11-19T08:00:00.000Z",
    "totalDaysActive": 50,
    "updatedAt": "2025-11-25T14:30:00.000Z"
  }
}
```

### Example 3: Fetching Analytics (Last 30 Days)

```bash
curl -X GET "http://localhost:3000/api/streak/analytics?days=30" \
  -H "Cookie: auth-token=..." \
  -H "Accept: application/json"
```

Response:
```json
{
  "success": true,
  "data": {
    "streak": {
      "currentStreak": 7,
      "longestStreak": 15,
      "dailyThreshold": 10,
      "totalDaysActive": 50
    },
    "dailyReadingHistory": [
      { "date": "2025-10-26", "pagesRead": 12, "thresholdMet": true },
      { "date": "2025-10-27", "pagesRead": 8, "thresholdMet": false },
      { "date": "2025-10-28", "pagesRead": 15, "thresholdMet": true }
      // ... 27 more days
    ],
    "booksAheadOrBehind": 2
  }
}
```

## Implementation Notes

### Next.js API Route Structure

```typescript
// app/api/streak/route.ts
export async function GET(request: Request): Promise<Response>
export async function PATCH(request: Request): Promise<Response>

// app/api/streak/analytics/route.ts
export async function GET(request: Request): Promise<Response>
```

### Error Handling Pattern

```typescript
try {
  // Business logic
  return Response.json({ success: true, data: result });
} catch (error) {
  logger.error({ error }, "Streak operation failed");
  return Response.json(
    {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred"
      }
    },
    { status: 500 }
  );
}
```

### Validation Pattern

```typescript
function validateThreshold(threshold: number): void {
  if (!Number.isInteger(threshold)) {
    throw new ValidationError("Threshold must be an integer");
  }
  if (threshold < 1 || threshold > 9999) {
    throw new ValidationError("Threshold must be between 1 and 9999");
  }
}
```

## Testing Contracts

### Contract Test Cases

1. **GET /api/streak**
   - Returns 200 with valid streak data
   - Returns 404 if no streak exists
   - Response matches StreakSummary interface

2. **PATCH /api/streak/threshold**
   - Returns 200 with updated streak when valid threshold
   - Returns 400 when threshold < 1
   - Returns 400 when threshold > 9999
   - Returns 400 when threshold is not a number
   - Returns 404 if no streak exists

3. **GET /api/streak/analytics**
   - Returns 200 with valid analytics data
   - Returns 400 when days < 1 or days > 365
   - Returns analytics without booksAheadOrBehind if no goal
   - Includes booksAheadOrBehind when goal exists

## Versioning

Current version: v1 (implicit)

No versioning in URL path for initial release. If breaking changes needed in future, consider:
- `/api/v2/streak` (URL versioning)
- `Accept: application/vnd.tome.v2+json` (header versioning)
