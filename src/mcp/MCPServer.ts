import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { OrderPrimitive } from '../primitives/OrderPrimitive';
import { InventoryPrimitive } from '../primitives/InventoryPrimitive';
import { TicketPrimitive } from '../primitives/TicketPrimitive';
import { RateLimiterAndResilience } from '../resilience/RateLimiter';
import { AuthManager } from '../auth/AuthManager';

export class MerchantMCPServer {
  private server: Server;
  private orderPrimitive: OrderPrimitive;
  private inventoryPrimitive: InventoryPrimitive;
  private ticketPrimitive: TicketPrimitive;
  private resilience: RateLimiterAndResilience;
  private authManager: AuthManager;

  constructor(
    orderPrimitive: OrderPrimitive,
    inventoryPrimitive: InventoryPrimitive,
    ticketPrimitive: TicketPrimitive,
    resilience: RateLimiterAndResilience,
    authManager: AuthManager
  ) {
    this.orderPrimitive = orderPrimitive;
    this.inventoryPrimitive = inventoryPrimitive;
    this.ticketPrimitive = ticketPrimitive;
    this.resilience = resilience;
    this.authManager = authManager;

    this.server = new Server(
      {
        name: 'razorpay-agent-studio-merchant-connector',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    this.registerToolHandlers();
  }

  /**
   * Defines and registers all MCP tools exposed to Agent Studio
   */
  private registerToolHandlers(): void {
    // 1. Tool Directory Listing
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          // Order Tools
          {
            name: 'woocommerce_list_orders',
            description: 'List merchant e-commerce orders from WooCommerce with optional filters (status, customer email, Razorpay payment status, date range, pagination).',
            inputSchema: {
              type: 'object',
              properties: {
                status: {
                  type: 'string',
                  enum: ['pending', 'processing', 'completed', 'on-hold', 'cancelled', 'refunded', 'failed'],
                  description: 'Filter orders by order fulfillment status.',
                },
                customerEmail: {
                  type: 'string',
                  description: 'Filter orders belonging to a specific customer email address.',
                },
                razorpayStatus: {
                  type: 'string',
                  enum: ['paid', 'unpaid', 'refunded', 'partially_refunded'],
                  description: 'Filter by Razorpay payment collection status.',
                },
                startDate: {
                  type: 'string',
                  description: 'ISO start date filter (e.g. 2026-09-01T00:00:00Z).',
                },
                endDate: {
                  type: 'string',
                  description: 'ISO end date filter (e.g. 2026-09-30T23:59:59Z).',
                },
                limit: {
                  type: 'number',
                  default: 10,
                  description: 'Number of orders to return per page (max 100).',
                },
                page: {
                  type: 'number',
                  default: 1,
                  description: 'Page number for pagination.',
                },
              },
            },
          },
          {
            name: 'woocommerce_get_order',
            description: 'Retrieve detailed information for a single order including line items, shipping address, Razorpay payment ID, and transaction history.',
            inputSchema: {
              type: 'object',
              properties: {
                orderId: {
                  type: 'string',
                  description: 'The internal Order ID (e.g. ord_1001) or WooCommerce Order Number (e.g. WC-1001).',
                },
              },
              required: ['orderId'],
            },
          },
          {
            name: 'woocommerce_search_orders',
            description: 'Search merchant orders using free-text queries matching customer name, email, Razorpay payment ID, SKU, or city.',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Search string (e.g. customer name, email address, pay_Pz9K7jL1, product SKU, or city).',
                },
                limit: {
                  type: 'number',
                  default: 10,
                },
                page: {
                  type: 'number',
                  default: 1,
                },
              },
              required: ['query'],
            },
          },

          // Inventory Tools
          {
            name: 'woocommerce_list_inventory',
            description: 'List merchant products and stock levels. Filter by category, stock status, or trigger low-stock alerts.',
            inputSchema: {
              type: 'object',
              properties: {
                category: {
                  type: 'string',
                  description: 'Filter by product category (e.g. Payment Hardware, POS Devices, Scanners, Supplies).',
                },
                stockStatus: {
                  type: 'string',
                  enum: ['instock', 'outofstock', 'onbackorder'],
                  description: 'Filter items by current stock availability.',
                },
                lowStockOnly: {
                  type: 'boolean',
                  description: 'Set to true to only return items at or below low stock threshold.',
                },
                limit: {
                  type: 'number',
                  default: 10,
                },
                page: {
                  type: 'number',
                  default: 1,
                },
              },
            },
          },
          {
            name: 'woocommerce_get_product',
            description: 'Retrieve detailed specs, stock quantity, price, and variant attributes for a product by ID or SKU.',
            inputSchema: {
              type: 'object',
              properties: {
                productIdOrSku: {
                  type: 'string',
                  description: 'Product ID (e.g. 101) or SKU string (e.g. RZP-SND-01).',
                },
              },
              required: ['productIdOrSku'],
            },
          },
          {
            name: 'woocommerce_search_inventory',
            description: 'Search merchant inventory by SKU, product title, category, or description keywords.',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Search terms matching product title, SKU (e.g. RZP-POS-PRO), or product description.',
                },
                limit: {
                  type: 'number',
                  default: 10,
                },
                page: {
                  type: 'number',
                  default: 1,
                },
              },
              required: ['query'],
            },
          },

          // Ticket & Customer Service Tools
          {
            name: 'merchant_list_tickets',
            description: 'List customer support tickets associated with merchant orders (Freshdesk / Support Integration).',
            inputSchema: {
              type: 'object',
              properties: {
                status: {
                  type: 'string',
                  enum: ['open', 'pending', 'resolved', 'closed'],
                },
                priority: {
                  type: 'string',
                  enum: ['low', 'medium', 'high', 'urgent'],
                },
                customerEmail: {
                  type: 'string',
                },
                orderId: {
                  type: 'string',
                },
                limit: {
                  type: 'number',
                  default: 10,
                },
                page: {
                  type: 'number',
                  default: 1,
                },
              },
            },
          },
          {
            name: 'merchant_get_ticket',
            description: 'Fetch complete customer support ticket details by Ticket ID or Ticket Number.',
            inputSchema: {
              type: 'object',
              properties: {
                ticketId: {
                  type: 'string',
                  description: 'Ticket ID (e.g. tkt_7001) or Ticket Number (e.g. FD-7001).',
                },
              },
              required: ['ticketId'],
            },
          },
          {
            name: 'merchant_search_tickets',
            description: 'Search customer support tickets by customer name, email, subject, or issue description.',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Search query string.',
                },
                limit: {
                  type: 'number',
                  default: 10,
                },
                page: {
                  type: 'number',
                  default: 1,
                },
              },
              required: ['query'],
            },
          },
        ],
      };
    });

    // 2. Tool Execution Request Handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args = {} } = request.params;

      try {
        let responseData: any;

        switch (name) {
          case 'woocommerce_list_orders':
            responseData = await this.orderPrimitive.list(args as any);
            break;
          case 'woocommerce_get_order':
            responseData = await this.orderPrimitive.get((args as any).orderId);
            break;
          case 'woocommerce_search_orders':
            responseData = await this.orderPrimitive.search(args as any);
            break;

          case 'woocommerce_list_inventory':
            responseData = await this.inventoryPrimitive.list(args as any);
            break;
          case 'woocommerce_get_product':
            responseData = await this.inventoryPrimitive.get((args as any).productIdOrSku);
            break;
          case 'woocommerce_search_inventory':
            responseData = await this.inventoryPrimitive.search(args as any);
            break;

          case 'merchant_list_tickets':
            responseData = await this.ticketPrimitive.list(args as any);
            break;
          case 'merchant_get_ticket':
            responseData = await this.ticketPrimitive.get((args as any).ticketId);
            break;
          case 'merchant_search_tickets':
            responseData = await this.ticketPrimitive.search(args as any);
            break;

          default:
            throw new Error(`Unknown MCP Tool: '${name}'`);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(responseData, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  error: true,
                  message: error.message || 'Error executing tool operation',
                  tool: name,
                  timestamp: new Date().toISOString(),
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }
    });
  }

  /**
   * Helper to execute tool calls directly via programmatic API (used by server REST endpoints / UI playground)
   */
  public async executeToolDirect(name: string, args: Record<string, any>): Promise<any> {
    switch (name) {
      case 'woocommerce_list_orders':
        return await this.orderPrimitive.list(args);
      case 'woocommerce_get_order':
        return await this.orderPrimitive.get(args.orderId);
      case 'woocommerce_search_orders':
        return await this.orderPrimitive.search(args as any);
      case 'woocommerce_list_inventory':
        return await this.inventoryPrimitive.list(args);
      case 'woocommerce_get_product':
        return await this.inventoryPrimitive.get(args.productIdOrSku);
      case 'woocommerce_search_inventory':
        return await this.inventoryPrimitive.search(args as any);
      case 'merchant_list_tickets':
        return await this.ticketPrimitive.list(args);
      case 'merchant_get_ticket':
        return await this.ticketPrimitive.get(args.ticketId);
      case 'merchant_search_tickets':
        return await this.ticketPrimitive.search(args as any);
      default:
        throw new Error(`Unknown Tool Name: '${name}'`);
    }
  }

  public getSDKServer(): Server {
    return this.server;
  }
}
