import { InventoryItem, ListInventoryParams, SearchParams, PaginatedResult } from '../types';
import { AuthManager } from '../auth/AuthManager';
import { RateLimiterAndResilience } from '../resilience/RateLimiter';
import { INITIAL_MOCK_INVENTORY } from '../mock-server/mockDataStore';

export class InventoryPrimitive {
  private authManager: AuthManager;
  private resilience: RateLimiterAndResilience;
  private mockStore: InventoryItem[];

  constructor(authManager: AuthManager, resilience: RateLimiterAndResilience, mockInventory?: InventoryItem[]) {
    this.authManager = authManager;
    this.resilience = resilience;
    this.mockStore = mockInventory || [...INITIAL_MOCK_INVENTORY];
  }

  /**
   * List inventory items with filtering by category, stock status, or low-stock warning threshold.
   */
  public async list(params: ListInventoryParams = {}): Promise<PaginatedResult<InventoryItem>> {
    const cacheKey = `inventory_list_${JSON.stringify(params)}`;

    const res = await this.resilience.executeWithResilience(async () => {
      const authValidation = await this.authManager.validateCredentials();
      if (!authValidation.valid) {
        throw new Error(`Authentication Failed: ${authValidation.message}`);
      }

      let filtered = [...this.mockStore];

      if (params.category) {
        const catQuery = params.category.toLowerCase().trim();
        filtered = filtered.filter((i) => i.category.toLowerCase() === catQuery);
      }

      if (params.stockStatus) {
        filtered = filtered.filter((i) => i.stockStatus === params.stockStatus);
      }

      if (params.lowStockOnly) {
        filtered = filtered.filter((i) => i.isLowStock || i.stockQuantity <= (i.lowStockThreshold || 5));
      }

      // Sort
      const sortBy = params.sortBy || 'title';
      const sortOrder = params.sortOrder || 'asc';
      filtered.sort((a, b) => {
        let valA: any = a[sortBy as keyof InventoryItem] ?? '';
        let valB: any = b[sortBy as keyof InventoryItem] ?? '';
        if (typeof valA === 'string') {
          return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      });

      // Pagination
      const limit = Math.max(1, Math.min(100, params.limit || 10));
      const page = Math.max(1, params.page || 1);
      const total = filtered.length;
      const totalPages = Math.ceil(total / limit) || 1;
      const startIndex = (page - 1) * limit;
      const paginatedData = filtered.slice(startIndex, startIndex + limit);

      const statusMetrics = this.resilience.getStatus();

      return {
        data: paginatedData,
        pagination: {
          total,
          page,
          limit,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
        metadata: {
          source: 'WooCommerce Product & Inventory API',
          fetchedAt: new Date().toISOString(),
          cached: false,
          executionTimeMs: 0,
          rateLimitRemaining: statusMetrics.tokensRemaining,
        },
      };
    }, cacheKey);

    return res.data;
  }

  /**
   * Get product/inventory item details by Product ID or SKU
   */
  public async get(productIdOrSku: string): Promise<InventoryItem> {
    const cacheKey = `inventory_get_${productIdOrSku}`;

    const result = await this.resilience.executeWithResilience(async () => {
      const authValidation = await this.authManager.validateCredentials();
      if (!authValidation.valid) {
        throw new Error(`Authentication Failed: ${authValidation.message}`);
      }

      const item = this.mockStore.find(
        (i) => i.id === productIdOrSku || i.sku.toLowerCase() === productIdOrSku.toLowerCase()
      );

      if (!item) {
        throw new Error(`Inventory item not found for ID/SKU: '${productIdOrSku}'`);
      }

      return item;
    }, cacheKey);

    return result.data;
  }

  /**
   * Search inventory by SKU, product title, category, or description
   */
  public async search(params: SearchParams): Promise<PaginatedResult<InventoryItem>> {
    const query = params.query.toLowerCase().trim();
    const cacheKey = `inventory_search_${query}_${params.page || 1}_${params.limit || 10}`;

    const res = await this.resilience.executeWithResilience(async () => {
      const authValidation = await this.authManager.validateCredentials();
      if (!authValidation.valid) {
        throw new Error(`Authentication Failed: ${authValidation.message}`);
      }

      const matched = this.mockStore.filter((i) => {
        return (
          i.sku.toLowerCase().includes(query) ||
          i.title.toLowerCase().includes(query) ||
          i.category.toLowerCase().includes(query) ||
          (i.description && i.description.toLowerCase().includes(query))
        );
      });

      const limit = Math.max(1, Math.min(100, params.limit || 10));
      const page = Math.max(1, params.page || 1);
      const total = matched.length;
      const totalPages = Math.ceil(total / limit) || 1;
      const startIndex = (page - 1) * limit;
      const paginatedData = matched.slice(startIndex, startIndex + limit);

      const statusMetrics = this.resilience.getStatus();

      return {
        data: paginatedData,
        pagination: {
          total,
          page,
          limit,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
        metadata: {
          source: 'WooCommerce Inventory Search API',
          fetchedAt: new Date().toISOString(),
          cached: false,
          executionTimeMs: 0,
          rateLimitRemaining: statusMetrics.tokensRemaining,
        },
      };
    }, cacheKey);

    return res.data;
  }
}
