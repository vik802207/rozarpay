import { Order, ListOrdersParams, SearchParams, PaginatedResult } from '../types';
import { AuthManager } from '../auth/AuthManager';
import { RateLimiterAndResilience } from '../resilience/RateLimiter';
export declare class OrderPrimitive {
    private authManager;
    private resilience;
    private mockStore;
    constructor(authManager: AuthManager, resilience: RateLimiterAndResilience, mockOrders?: Order[]);
    /**
     * List orders with optional filtering by status, customer email, date range, or Razorpay payment status.
     */
    list(params?: ListOrdersParams): Promise<PaginatedResult<Order>>;
    /**
     * Get specific order by Order ID or Order Number
     */
    get(orderId: string): Promise<Order>;
    /**
     * Search orders across customer name, email, order ID, Razorpay IDs, SKU, or shipping city
     */
    search(params: SearchParams): Promise<PaginatedResult<Order>>;
}
