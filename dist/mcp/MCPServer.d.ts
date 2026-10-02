import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { OrderPrimitive } from '../primitives/OrderPrimitive';
import { InventoryPrimitive } from '../primitives/InventoryPrimitive';
import { TicketPrimitive } from '../primitives/TicketPrimitive';
import { RateLimiterAndResilience } from '../resilience/RateLimiter';
import { AuthManager } from '../auth/AuthManager';
export declare class MerchantMCPServer {
    private server;
    private orderPrimitive;
    private inventoryPrimitive;
    private ticketPrimitive;
    private resilience;
    private authManager;
    constructor(orderPrimitive: OrderPrimitive, inventoryPrimitive: InventoryPrimitive, ticketPrimitive: TicketPrimitive, resilience: RateLimiterAndResilience, authManager: AuthManager);
    /**
     * Defines and registers all MCP tools exposed to Agent Studio
     */
    private registerToolHandlers;
    /**
     * Helper to execute tool calls directly via programmatic API (used by server REST endpoints / UI playground)
     */
    executeToolDirect(name: string, args: Record<string, any>): Promise<any>;
    getSDKServer(): Server;
}
