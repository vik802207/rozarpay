import { describe, it, expect, beforeEach } from 'vitest';
import { AuthManager } from '../src/auth/AuthManager';
import { RateLimiterAndResilience } from '../src/resilience/RateLimiter';
import { OrderPrimitive } from '../src/primitives/OrderPrimitive';
import { InventoryPrimitive } from '../src/primitives/InventoryPrimitive';
import { TicketPrimitive } from '../src/primitives/TicketPrimitive';
import { MerchantMCPServer } from '../src/mcp/MCPServer';
import { AuthConfig } from '../src/types';

describe('Razorpay Agent Studio - Private Merchant Connector Test Suite', () => {
  let authManager: AuthManager;
  let resilience: RateLimiterAndResilience;
  let orderPrimitive: OrderPrimitive;
  let inventoryPrimitive: InventoryPrimitive;
  let ticketPrimitive: TicketPrimitive;
  let mcpServer: MerchantMCPServer;

  const sampleApiKeyConfig: AuthConfig = {
    type: 'api_key',
    credentials: {
      consumerKey: 'ck_test_123456789',
      consumerSecret: 'cs_test_987654321',
    },
    storeUrl: 'https://teststore.razorpay-merchant.in',
  };

  const sampleOauthConfig: AuthConfig = {
    type: 'oauth2',
    credentials: {
      clientId: 'client_app_razorpay',
      clientSecret: 'secret_app_razorpay',
    },
    storeUrl: 'https://teststore.razorpay-merchant.in',
  };

  beforeEach(() => {
    authManager = new AuthManager(sampleApiKeyConfig);
    resilience = new RateLimiterAndResilience({
      maxRequestsPerMinute: 60,
      burstLimit: 15,
    });
    orderPrimitive = new OrderPrimitive(authManager, resilience);
    inventoryPrimitive = new InventoryPrimitive(authManager, resilience);
    ticketPrimitive = new TicketPrimitive(authManager, resilience);
    mcpServer = new MerchantMCPServer(
      orderPrimitive,
      inventoryPrimitive,
      ticketPrimitive,
      resilience,
      authManager
    );
  });

  describe('1. Authentication Flow', () => {
    it('should validate API Key credentials successfully', async () => {
      const validation = await authManager.validateCredentials();
      expect(validation.valid).toBe(true);
      expect(validation.mode).toBe('api_key');
    });

    it('should generate Basic Auth header for API Key authentication', async () => {
      const headers = await authManager.getAuthHeaders('GET', 'https://teststore.razorpay-merchant.in/wp-json/wc/v3/orders');
      expect(headers.headers['Authorization']).toContain('Basic ');
      expect(headers.headers['X-Connector-Auth-Type']).toBe('api_key_hmac');
    });

    it('should support OAuth 2.0 bearer token generation & refresh', async () => {
      const oauthManager = new AuthManager(sampleOauthConfig);
      const token = await oauthManager.getValidOAuthToken();
      expect(token).toContain('oauth_token_');

      const headers = await oauthManager.getAuthHeaders();
      expect(headers.headers['Authorization']).toBe(`Bearer ${token}`);
      expect(headers.headers['X-Connector-Auth-Type']).toBe('oauth2_bearer');
    });
  });

  describe('2. Order Primitives (List / Get / Search)', () => {
    it('should list orders with default pagination', async () => {
      const result = await orderPrimitive.list({ limit: 10 });
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.pagination.total).toBe(5);
      expect(result.data[0]).toHaveProperty('orderNumber');
    });

    it('should filter orders by order status (processing)', async () => {
      const result = await orderPrimitive.list({ status: 'processing' });
      expect(result.data.every((o) => o.status === 'processing')).toBe(true);
    });

    it('should filter orders by Razorpay payment status (unpaid)', async () => {
      const result = await orderPrimitive.list({ razorpayStatus: 'unpaid' });
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data.every((o) => o.paymentStatus === 'unpaid')).toBe(true);
    });

    it('should retrieve a specific order by ID (ord_1001)', async () => {
      const order = await orderPrimitive.get('ord_1001');
      expect(order.id).toBe('ord_1001');
      expect(order.customer.name).toBe('Ananya Sharma');
      expect(order.razorpayPaymentId).toBe('pay_Pz9K7jL1wE4m2v');
    });

    it('should throw error when requesting non-existent order', async () => {
      await expect(orderPrimitive.get('ord_nonexistent')).rejects.toThrow('Order not found');
    });

    it('should search orders by Razorpay Payment ID', async () => {
      const result = await orderPrimitive.search({ query: 'pay_Pz9K7jL1wE4m2v' });
      expect(result.data.length).toBe(1);
      expect(result.data[0].id).toBe('ord_1001');
    });
  });

  describe('3. Inventory Primitives (List / Get / Search)', () => {
    it('should list inventory items', async () => {
      const result = await inventoryPrimitive.list();
      expect(result.data.length).toBe(5);
    });

    it('should filter inventory by low stock threshold', async () => {
      const result = await inventoryPrimitive.list({ lowStockOnly: true });
      expect(result.data.every((item) => item.isLowStock || item.stockQuantity <= (item.lowStockThreshold || 5))).toBe(true);
    });

    it('should get product details by SKU (RZP-SND-01)', async () => {
      const product = await inventoryPrimitive.get('RZP-SND-01');
      expect(product.title).toBe('Razorpay Smart Soundbox Hub');
      expect(product.price).toBe(2999);
    });

    it('should search inventory items by keyword (POS)', async () => {
      const result = await inventoryPrimitive.search({ query: 'POS' });
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0].sku).toBe('RZP-POS-PRO');
    });
  });

  describe('4. Support Ticket Primitives', () => {
    it('should list support tickets', async () => {
      const result = await ticketPrimitive.list();
      expect(result.data.length).toBe(2);
    });

    it('should search tickets by subject keyword', async () => {
      const result = await ticketPrimitive.search({ query: 'Soundbox' });
      expect(result.data.length).toBe(1);
      expect(result.data[0].ticketNumber).toBe('FD-7001');
    });
  });

  describe('5. Rate Limiter & Resilience Engine', () => {
    it('should track token bucket consumption and status', async () => {
      const statusBefore = resilience.getStatus();
      expect(statusBefore.tokensRemaining).toBe(15);

      await resilience.acquireToken();
      const statusAfter = resilience.getStatus();
      expect(statusAfter.tokensRemaining).toBe(14);
      expect(statusAfter.totalRequestsProcessed).toBe(1);
    });

    it('should cache read responses to preserve rate limit quota', async () => {
      const firstCall = await orderPrimitive.get('ord_1001');
      expect(firstCall.id).toBe('ord_1001');

      // Second call should serve from cache
      const secondCallResult = await resilience.executeWithResilience(
        async () => orderPrimitive.get('ord_1001'),
        'order_get_ord_1001'
      );
      expect(secondCallResult.cached).toBe(true);
    });
  });

  describe('6. Model Context Protocol (MCP) Tool Execution', () => {
    it('should execute woocommerce_list_orders tool via MCP server handler', async () => {
      const result = await mcpServer.executeToolDirect('woocommerce_list_orders', { limit: 2 });
      expect(result.data.length).toBe(2);
      expect(result.metadata.source).toContain('WooCommerce Order API');
    });

    it('should execute woocommerce_get_product tool via MCP server handler', async () => {
      const result = await mcpServer.executeToolDirect('woocommerce_get_product', { productIdOrSku: 'RZP-SND-01' });
      expect(result.sku).toBe('RZP-SND-01');
      expect(result.price).toBe(2999);
    });
  });
});
