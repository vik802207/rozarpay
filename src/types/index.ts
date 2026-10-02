/**
 * Core Data Models & Connector Interfaces for Razorpay Agent Studio Private Connector
 */

// Authentication Types
export type AuthType = 'api_key' | 'oauth2';

export interface ApiKeyCredentials {
  consumerKey: string;
  consumerSecret: string;
}

export interface OAuth2Credentials {
  clientId: string;
  clientSecret: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  tokenUrl?: string;
}

export interface AuthConfig {
  type: AuthType;
  credentials: ApiKeyCredentials | OAuth2Credentials;
  storeUrl: string;
}

// Data Models - Orders
export interface LineItem {
  id: string | number;
  name: string;
  productId: number;
  variantId?: number;
  quantity: number;
  price: number;
  total: number;
  sku: string;
}

export interface CustomerSummary {
  id: string | number;
  name: string;
  email: string;
  phone?: string;
  city?: string;
  country?: string;
}

export type OrderStatus = 'pending' | 'processing' | 'completed' | 'on-hold' | 'cancelled' | 'refunded' | 'failed';

export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  currency: string;
  totalAmount: number;
  taxAmount: number;
  shippingAmount: number;
  paymentMethod: string;
  paymentStatus: 'paid' | 'unpaid' | 'refunded' | 'partially_refunded';
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
  createdAt: string;
  updatedAt: string;
  customer: CustomerSummary;
  lineItems: LineItem[];
  shippingAddress: {
    address1: string;
    address2?: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
  };
  notes?: string[];
}

// Data Models - Inventory / Products
export interface ProductVariant {
  id: string | number;
  sku: string;
  title: string;
  price: number;
  stockQuantity: number;
  inStock: boolean;
  attributes?: Record<string, string>;
}

export interface InventoryItem {
  id: string;
  productId: string;
  sku: string;
  title: string;
  description?: string;
  category: string;
  price: number;
  regularPrice: number;
  salePrice?: number;
  stockQuantity: number;
  stockStatus: 'instock' | 'outofstock' | 'onbackorder';
  lowStockThreshold?: number;
  isLowStock: boolean;
  variants?: ProductVariant[];
  updatedAt: string;
}

// Data Models - Support Tickets (Cross-tool merchant context)
export interface SupportTicket {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  status: 'open' | 'pending' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  customerEmail: string;
  customerName: string;
  associatedOrderId?: string;
  createdAt: string;
  updatedAt: string;
}

// Query Primitives & Filter Parameters
export interface ListOrdersParams {
  status?: OrderStatus;
  customerEmail?: string;
  startDate?: string;
  endDate?: string;
  razorpayStatus?: 'paid' | 'unpaid' | 'refunded';
  limit?: number;
  page?: number;
  sortBy?: 'createdAt' | 'totalAmount';
  sortOrder?: 'asc' | 'desc';
}

export interface ListInventoryParams {
  category?: string;
  stockStatus?: 'instock' | 'outofstock' | 'onbackorder';
  lowStockOnly?: boolean;
  limit?: number;
  page?: number;
  sortBy?: 'stockQuantity' | 'title' | 'price';
  sortOrder?: 'asc' | 'desc';
}

export interface ListTicketsParams {
  status?: 'open' | 'pending' | 'resolved' | 'closed';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  customerEmail?: string;
  orderId?: string;
  limit?: number;
  page?: number;
}

export interface SearchParams {
  query: string;
  limit?: number;
  page?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  metadata: {
    source: string;
    fetchedAt: string;
    cached: boolean;
    executionTimeMs: number;
    rateLimitRemaining: number;
  };
}

// Rate Limiter Config & Stats
export interface RateLimitConfig {
  maxRequestsPerMinute: number;
  burstLimit: number;
  retryMaxAttempts: number;
  backoffBaseMs: number;
  backoffMaxMs: number;
}

export interface RateLimitStatus {
  tokensRemaining: number;
  maxTokens: number;
  fillRatePerSec: number;
  totalRequestsProcessed: number;
  totalThrottledRequests: number;
  circuitBreakerStatus: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
}

// MCP Interface Definitions
export interface MCPToolCallRequest {
  tool: string;
  arguments: Record<string, any>;
}

export interface MCPToolCallResponse {
  content: Array<{
    type: 'text' | 'resource';
    text?: string;
    resource?: any;
  }>;
  isError?: boolean;
}
