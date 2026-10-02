import { RateLimitConfig, RateLimitStatus } from '../types';
export interface CacheEntry<T> {
    data: T;
    expiresAt: number;
}
export declare class RateLimiterAndResilience {
    private maxTokens;
    private tokens;
    private fillRatePerSec;
    private lastRefillTimestamp;
    private retryMaxAttempts;
    private backoffBaseMs;
    private backoffMaxMs;
    private totalRequestsProcessed;
    private totalThrottledRequests;
    private circuitState;
    private consecutiveFailures;
    private failureThreshold;
    private nextAttemptTimestamp;
    private cache;
    private defaultTtlMs;
    constructor(config?: Partial<RateLimitConfig>);
    /**
     * Refills tokens based on elapsed time since last request.
     */
    private refillTokens;
    /**
     * Acquires a token from the bucket. Pauses if rate limit is reached.
     */
    acquireToken(): Promise<void>;
    /**
     * Wraps an API request with rate limiting, retries with exponential backoff + jitter, and circuit breaker logic.
     */
    executeWithResilience<T>(operation: () => Promise<T>, cacheKey?: string, ttlMs?: number): Promise<{
        data: T;
        cached: boolean;
        executionTimeMs: number;
    }>;
    /**
     * Calculates exponential backoff with full jitter
     */
    private calculateBackoff;
    /**
     * Circuit Breaker logic
     */
    private checkCircuitBreaker;
    private recordSuccess;
    private recordFailure;
    /**
     * Returns current rate limiter and resiliency status metrics
     */
    getStatus(): RateLimitStatus;
    /**
     * Flushes response cache
     */
    clearCache(): void;
}
