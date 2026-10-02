import { AuthConfig } from '../types';
export interface AuthHeaderResult {
    headers: Record<string, string>;
    urlWithAuth?: string;
}
export declare class AuthManager {
    private config;
    private currentAccessToken;
    private tokenExpiresAt;
    constructor(config: AuthConfig);
    /**
     * Returns formatted request headers (or authenticated URL params) for merchant API calls.
     */
    getAuthHeaders(method?: string, url?: string): Promise<AuthHeaderResult>;
    /**
     * Ensures a valid OAuth 2.0 access token, executing refresh flow if token is expired.
     */
    getValidOAuthToken(): Promise<string>;
    /**
     * Executes OAuth 2.0 Token Refresh / Exchange
     */
    private refreshOAuthToken;
    /**
     * Validates configured credentials by checking connection readiness
     */
    validateCredentials(): Promise<{
        valid: boolean;
        message: string;
        mode: string;
    }>;
    /**
     * Returns sanitized authentication configuration for safe logging / API responses
     */
    getSanitizedConfig(): {
        type: "api_key";
        storeUrl: string;
        consumerKey: string | null;
        clientId?: undefined;
        hasAccessToken?: undefined;
        tokenExpiresInSec?: undefined;
    } | {
        type: "oauth2";
        storeUrl: string;
        clientId: string | null;
        hasAccessToken: boolean;
        tokenExpiresInSec: number;
        consumerKey?: undefined;
    };
}
