import { InventoryItem, ListInventoryParams, SearchParams, PaginatedResult } from '../types';
import { AuthManager } from '../auth/AuthManager';
import { RateLimiterAndResilience } from '../resilience/RateLimiter';
export declare class InventoryPrimitive {
    private authManager;
    private resilience;
    private mockStore;
    constructor(authManager: AuthManager, resilience: RateLimiterAndResilience, mockInventory?: InventoryItem[]);
    /**
     * List inventory items with filtering by category, stock status, or low-stock warning threshold.
     */
    list(params?: ListInventoryParams): Promise<PaginatedResult<InventoryItem>>;
    /**
     * Get product/inventory item details by Product ID or SKU
     */
    get(productIdOrSku: string): Promise<InventoryItem>;
    /**
     * Search inventory by SKU, product title, category, or description
     */
    search(params: SearchParams): Promise<PaginatedResult<InventoryItem>>;
}
