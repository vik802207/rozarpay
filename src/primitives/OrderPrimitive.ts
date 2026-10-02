import { Order, ListOrdersParams, SearchParams, PaginatedResult } from '../types';
import { AuthManager } from '../auth/AuthManager';
import { RateLimiterAndResilience } from '../resilience/RateLimiter';
import { INITIAL_MOCK_ORDERS } from '../mock-server/mockDataStore';

export class OrderPrimitive {
  private authManager: AuthManager;
  private resilience: RateLimiterAndResilience;
  private mockStore: Order[];

  constructor(authManager: AuthManager, resilience: RateLimiterAndResilience, mockOrders?: Order[]) {
    this.authManager = authManager;
    this.resilience = resilience;
    this.mockStore = mockOrders || [...INITIAL_MOCK_ORDERS];
  }

  /**
   * List orders with optional filtering by status, customer email, date range, or Razorpay payment status.
   */
  public async list(params: ListOrdersParams = {}): Promise<PaginatedResult<Order>> {
    const cacheKey = `orders_list_${JSON.stringify(params)}`;

    const res = await this.resilience.executeWithResilience(async () => {
      // Validate credentials before making calls
      const authValidation = await this.authManager.validateCredentials();
      if (!authValidation.valid) {
        throw new Error(`Authentication Failed: ${authValidation.message}`);
      }

      let filtered = [...this.mockStore];

      if (params.status) {
        filtered = filtered.filter((o) => o.status === params.status);
      }

      if (params.customerEmail) {
        const queryEmail = params.customerEmail.toLowerCase().trim();
        filtered = filtered.filter((o) => o.customer.email.toLowerCase().includes(queryEmail));
      }

      if (params.razorpayStatus) {
        filtered = filtered.filter((o) => o.paymentStatus === params.razorpayStatus);
      }

      if (params.startDate) {
        const start = new Date(params.startDate).getTime();
        filtered = filtered.filter((o) => new Date(o.createdAt).getTime() >= start);
      }

      if (params.endDate) {
        const end = new Date(params.endDate).getTime();
        filtered = filtered.filter((o) => new Date(o.createdAt).getTime() <= end);
      }

      // Sort
      const sortBy = params.sortBy || 'createdAt';
      const sortOrder = params.sortOrder || 'desc';
      filtered.sort((a, b) => {
        let valA = sortBy === 'totalAmount' ? a.totalAmount : new Date(a.createdAt).getTime();
        let valB = sortBy === 'totalAmount' ? b.totalAmount : new Date(b.createdAt).getTime();
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
          source: 'WooCommerce Order API',
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
   * Get specific order by Order ID or Order Number
   */
  public async get(orderId: string): Promise<Order> {
    const cacheKey = `order_get_${orderId}`;

    const result = await this.resilience.executeWithResilience(async () => {
      const authValidation = await this.authManager.validateCredentials();
      if (!authValidation.valid) {
        throw new Error(`Authentication Failed: ${authValidation.message}`);
      }

      const order = this.mockStore.find(
        (o) => o.id === orderId || o.orderNumber.toLowerCase() === orderId.toLowerCase()
      );

      if (!order) {
        throw new Error(`Order not found for ID/Number: '${orderId}'`);
      }

      return order;
    }, cacheKey);

    return result.data;
  }

  /**
   * Search orders across customer name, email, order ID, Razorpay IDs, SKU, or shipping city
   */
  public async search(params: SearchParams): Promise<PaginatedResult<Order>> {
    const query = params.query.toLowerCase().trim();
    const cacheKey = `orders_search_${query}_${params.page || 1}_${params.limit || 10}`;

    const res = await this.resilience.executeWithResilience(async () => {
      const authValidation = await this.authManager.validateCredentials();
      if (!authValidation.valid) {
        throw new Error(`Authentication Failed: ${authValidation.message}`);
      }

      const matched = this.mockStore.filter((o) => {
        return (
          o.id.toLowerCase().includes(query) ||
          o.orderNumber.toLowerCase().includes(query) ||
          o.customer.name.toLowerCase().includes(query) ||
          o.customer.email.toLowerCase().includes(query) ||
          (o.razorpayOrderId && o.razorpayOrderId.toLowerCase().includes(query)) ||
          (o.razorpayPaymentId && o.razorpayPaymentId.toLowerCase().includes(query)) ||
          o.shippingAddress.city.toLowerCase().includes(query) ||
          o.lineItems.some((li) => li.sku.toLowerCase().includes(query) || li.name.toLowerCase().includes(query))
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
          source: 'WooCommerce Order Search API',
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
