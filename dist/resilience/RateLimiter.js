"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimiterAndResilience = void 0;
class RateLimiterAndResilience {
    maxTokens;
    tokens;
    fillRatePerSec;
    lastRefillTimestamp;
    retryMaxAttempts;
    backoffBaseMs;
    backoffMaxMs;
    // Metrics tracking
    totalRequestsProcessed = 0;
    totalThrottledRequests = 0;
    // Circuit Breaker State
    circuitState = 'CLOSED';
    consecutiveFailures = 0;
    failureThreshold = 5;
    nextAttemptTimestamp = 0;
    // Read Cache Engine
    cache = new Map();
    defaultTtlMs = 30000; // 30 second default cache
    constructor(config) {
        this.maxTokens = config?.burstLimit || 15;
        this.tokens = this.maxTokens;
        const requestsPerMin = config?.maxRequestsPerMinute || 60;
        this.fillRatePerSec = requestsPerMin / 60.0;
        this.lastRefillTimestamp = Date.now();
        this.retryMaxAttempts = config?.retryMaxAttempts || 3;
        this.backoffBaseMs = config?.backoffBaseMs || 300;
        this.backoffMaxMs = config?.backoffMaxMs || 5000;
    }
    /**
     * Refills tokens based on elapsed time since last request.
     */
    refillTokens() {
        const now = Date.now();
        const elapsedSec = (now - this.lastRefillTimestamp) / 1000.0;
        this.tokens = Math.min(this.maxTokens, this.tokens + elapsedSec * this.fillRatePerSec);
        this.lastRefillTimestamp = now;
    }
    /**
     * Acquires a token from the bucket. Pauses if rate limit is reached.
     */
    async acquireToken() {
        this.checkCircuitBreaker();
        this.refillTokens();
        if (this.tokens >= 1) {
            this.tokens -= 1;
            this.totalRequestsProcessed++;
            return;
        }
        // Token limit hit -> wait for refill
        this.totalThrottledRequests++;
        const waitMs = Math.ceil(((1 - this.tokens) / this.fillRatePerSec) * 1000);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        this.refillTokens();
        this.tokens = Math.max(0, this.tokens - 1);
        this.totalRequestsProcessed++;
    }
    /**
     * Wraps an API request with rate limiting, retries with exponential backoff + jitter, and circuit breaker logic.
     */
    async executeWithResilience(operation, cacheKey, ttlMs = this.defaultTtlMs) {
        const startTime = Date.now();
        // 1. Check Cache
        if (cacheKey && this.cache.has(cacheKey)) {
            const cachedItem = this.cache.get(cacheKey);
            if (Date.now() < cachedItem.expiresAt) {
                return {
                    data: cachedItem.data,
                    cached: true,
                    executionTimeMs: Date.now() - startTime,
                };
            }
            else {
                this.cache.delete(cacheKey);
            }
        }
        // 2. Acquire Rate Limit Token
        await this.acquireToken();
        // 3. Execute with Retry & Backoff
        let lastError = null;
        for (let attempt = 1; attempt <= this.retryMaxAttempts; attempt++) {
            try {
                const result = await operation();
                // Record success in Circuit Breaker
                this.recordSuccess();
                // Cache result if cacheKey provided
                if (cacheKey) {
                    this.cache.set(cacheKey, {
                        data: result,
                        expiresAt: Date.now() + ttlMs,
                    });
                }
                return {
                    data: result,
                    cached: false,
                    executionTimeMs: Date.now() - startTime,
                };
            }
            catch (err) {
                lastError = err;
                const isRateLimit = err?.status === 429 || err?.message?.includes('429') || err?.message?.includes('rate limit');
                const isServerError = err?.status >= 500 || !err?.status;
                if (attempt < this.retryMaxAttempts && (isRateLimit || isServerError)) {
                    const delay = this.calculateBackoff(attempt, isRateLimit);
                    await new Promise((res) => setTimeout(res, delay));
                }
                else {
                    this.recordFailure();
                    break;
                }
            }
        }
        throw lastError || new Error('Operation failed after retries');
    }
    /**
     * Calculates exponential backoff with full jitter
     */
    calculateBackoff(attempt, isRateLimit) {
        const base = isRateLimit ? this.backoffBaseMs * 2 : this.backoffBaseMs;
        const exponential = base * Math.pow(2, attempt - 1);
        const capped = Math.min(this.backoffMaxMs, exponential);
        // Add jitter: random between 50% and 100% of capped delay
        const jittered = capped * (0.5 + Math.random() * 0.5);
        return Math.floor(jittered);
    }
    /**
     * Circuit Breaker logic
     */
    checkCircuitBreaker() {
        if (this.circuitState === 'OPEN') {
            if (Date.now() > this.nextAttemptTimestamp) {
                this.circuitState = 'HALF_OPEN';
            }
            else {
                throw new Error('Circuit Breaker OPEN: Target merchant API is currently experiencing service disruption.');
            }
        }
    }
    recordSuccess() {
        if (this.circuitState === 'HALF_OPEN') {
            this.circuitState = 'CLOSED';
            this.consecutiveFailures = 0;
        }
        else if (this.circuitState === 'CLOSED') {
            this.consecutiveFailures = 0;
        }
    }
    recordFailure() {
        this.consecutiveFailures++;
        if (this.consecutiveFailures >= this.failureThreshold) {
            this.circuitState = 'OPEN';
            this.nextAttemptTimestamp = Date.now() + 15000; // Open for 15 seconds
        }
    }
    /**
     * Returns current rate limiter and resiliency status metrics
     */
    getStatus() {
        this.refillTokens();
        return {
            tokensRemaining: Math.floor(this.tokens * 10) / 10,
            maxTokens: this.maxTokens,
            fillRatePerSec: this.fillRatePerSec,
            totalRequestsProcessed: this.totalRequestsProcessed,
            totalThrottledRequests: this.totalThrottledRequests,
            circuitBreakerStatus: this.circuitState,
        };
    }
    /**
     * Flushes response cache
     */
    clearCache() {
        this.cache.clear();
    }
}
exports.RateLimiterAndResilience = RateLimiterAndResilience;
