import { AuthConfig } from './types';
import { AuthManager } from './auth/AuthManager';
import { RateLimiterAndResilience } from './resilience/RateLimiter';
import { OrderPrimitive } from './primitives/OrderPrimitive';
import { InventoryPrimitive } from './primitives/InventoryPrimitive';
import { TicketPrimitive } from './primitives/TicketPrimitive';
import { MerchantMCPServer } from './mcp/MCPServer';
export declare function createServer(customAuthConfig?: AuthConfig): {
    app: import("express-serve-static-core").Express;
    mcpServer: MerchantMCPServer;
    resilience: RateLimiterAndResilience;
    authManager: AuthManager;
    orderPrimitive: OrderPrimitive;
    inventoryPrimitive: InventoryPrimitive;
    ticketPrimitive: TicketPrimitive;
};
