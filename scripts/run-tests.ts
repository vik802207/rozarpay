import { AuthManager } from '../src/auth/AuthManager';
import { RateLimiterAndResilience } from '../src/resilience/RateLimiter';
import { OrderPrimitive } from '../src/primitives/OrderPrimitive';
import { InventoryPrimitive } from '../src/primitives/InventoryPrimitive';
import { TicketPrimitive } from '../src/primitives/TicketPrimitive';
import { MerchantMCPServer } from '../src/mcp/MCPServer';
import { AuthConfig } from '../src/types';

async function runTestSuite() {
  console.log('🧪 Starting Razorpay Agent Studio Connector Test Suite...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

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

  const authManager = new AuthManager(sampleApiKeyConfig);
  const resilience = new RateLimiterAndResilience({ maxRequestsPerMinute: 60, burstLimit: 15 });
  const orderPrimitive = new OrderPrimitive(authManager, resilience);
  const inventoryPrimitive = new InventoryPrimitive(authManager, resilience);
  const ticketPrimitive = new TicketPrimitive(authManager, resilience);
  const mcpServer = new MerchantMCPServer(orderPrimitive, inventoryPrimitive, ticketPrimitive, resilience, authManager);

  console.log('--- 1. Authentication Flow ---');
  const validation = await authManager.validateCredentials();
  assert(validation.valid === true && validation.mode === 'api_key', 'API Key validation');

  const headers = await authManager.getAuthHeaders('GET', 'https://teststore.razorpay-merchant.in');
  assert(headers.headers['Authorization'].includes('Basic '), 'Basic Auth Header Generation');

  const oauthManager = new AuthManager(sampleOauthConfig);
  const token = await oauthManager.getValidOAuthToken();
  assert(token.startsWith('oauth_token_'), 'OAuth 2.0 Token Refresh Mechanics');

  console.log('\n--- 2. Order Primitives ---');
  const ordersList = await orderPrimitive.list({ limit: 10 });
  assert(ordersList.data.length === 5, 'List all orders (count: 5)');

  const processingOrders = await orderPrimitive.list({ status: 'processing' });
  assert(processingOrders.data.every(o => o.status === 'processing'), 'Filter orders by status = processing');

  const unpaidOrders = await orderPrimitive.list({ razorpayStatus: 'unpaid' });
  assert(unpaidOrders.data.every(o => o.paymentStatus === 'unpaid'), 'Filter orders by Razorpay paymentStatus = unpaid');

  const orderGet = await orderPrimitive.get('ord_1001');
  assert(orderGet.id === 'ord_1001' && orderGet.customer.name === 'Ananya Sharma', 'Get order ord_1001');

  const orderSearch = await orderPrimitive.search({ query: 'pay_Pz9K7jL1wE4m2v' });
  assert(orderSearch.data.length === 1 && orderSearch.data[0].id === 'ord_1001', 'Search order by Razorpay Payment ID');

  console.log('\n--- 3. Inventory Primitives ---');
  const invList = await inventoryPrimitive.list();
  assert(invList.data.length === 5, 'List inventory (count: 5)');

  const lowStockList = await inventoryPrimitive.list({ lowStockOnly: true });
  assert(lowStockList.data.length > 0, 'Filter inventory lowStockOnly');

  const soundbox = await inventoryPrimitive.get('RZP-SND-01');
  assert(soundbox.title === 'Razorpay Smart Soundbox Hub' && soundbox.price === 2999, 'Get inventory by SKU RZP-SND-01');

  const posSearch = await inventoryPrimitive.search({ query: 'POS' });
  assert(posSearch.data[0].sku === 'RZP-POS-PRO', 'Search inventory by keyword POS');

  console.log('\n--- 4. Support Tickets ---');
  const tktList = await ticketPrimitive.list();
  assert(tktList.data.length === 2, 'List support tickets (count: 2)');

  const tktSearch = await ticketPrimitive.search({ query: 'Soundbox' });
  assert(tktSearch.data[0].ticketNumber === 'FD-7001', 'Search support tickets');

  console.log('\n--- 5. Rate Limiter & Resilience ---');
  const statusBefore = resilience.getStatus();
  await resilience.acquireToken();
  const statusAfter = resilience.getStatus();
  assert(Math.round(statusBefore.tokensRemaining - statusAfter.tokensRemaining) === 1, 'Token bucket token consumption');

  console.log('\n--- 6. MCP Server Integration ---');
  const mcpOrders = await mcpServer.executeToolDirect('woocommerce_list_orders', { limit: 2 });
  assert(mcpOrders.data.length === 2, 'MCP Tool Execution: woocommerce_list_orders');

  const mcpProduct = await mcpServer.executeToolDirect('woocommerce_get_product', { productIdOrSku: 'RZP-SND-01' });
  assert(mcpProduct.sku === 'RZP-SND-01', 'MCP Tool Execution: woocommerce_get_product');

  console.log(`\n=============================================================`);
  console.log(`🎉 TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log(`=============================================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
