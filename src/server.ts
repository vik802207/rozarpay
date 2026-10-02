import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { AuthConfig } from './types';
import { AuthManager } from './auth/AuthManager';
import { RateLimiterAndResilience } from './resilience/RateLimiter';
import { OrderPrimitive } from './primitives/OrderPrimitive';
import { InventoryPrimitive } from './primitives/InventoryPrimitive';
import { TicketPrimitive } from './primitives/TicketPrimitive';
import { MerchantMCPServer } from './mcp/MCPServer';

export function createServer(customAuthConfig?: AuthConfig) {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '../public')));

  // Initialize Default Connector Stack
  const authConfig: AuthConfig = customAuthConfig || {
    type: 'api_key',
    credentials: {
      consumerKey: 'ck_live_99a88b77c66d55e44',
      consumerSecret: 'cs_live_112233445566778899',
    },
    storeUrl: 'https://store.merchant.example.com',
  };

  const authManager = new AuthManager(authConfig);
  const resilience = new RateLimiterAndResilience({
    maxRequestsPerMinute: 60,
    burstLimit: 15,
  });

  const orderPrimitive = new OrderPrimitive(authManager, resilience);
  const inventoryPrimitive = new InventoryPrimitive(authManager, resilience);
  const ticketPrimitive = new TicketPrimitive(authManager, resilience);

  const mcpServer = new MerchantMCPServer(
    orderPrimitive,
    inventoryPrimitive,
    ticketPrimitive,
    resilience,
    authManager
  );

  // Store active SSE transports for MCP Agent Studio connections
  let sseTransports: Map<string, SSEServerTransport> = new Map();

  // 1. Live Connector Status Endpoint
  app.get('/api/status', (req: Request, res: Response) => {
    const rateStatus = resilience.getStatus();
    const authStatus = authManager.getSanitizedConfig();
    res.json({
      status: 'ONLINE',
      connector: 'Razorpay Agent Studio - Private Merchant Connector',
      merchantTool: 'WooCommerce & Support Integration',
      auth: authStatus,
      rateLimiter: rateStatus,
      ordersTotal: 5,
      inventoryTotal: 5,
      timestamp: new Date().toISOString(),
    });
  });

  // 2. Programmatic Tool Execution Endpoint (for Playground UI / REST Agents)
  app.post('/api/mcp/tool', async (req: Request, res: Response) => {
    try {
      const { tool, arguments: args } = req.body;
      if (!tool) {
        return res.status(400).json({ error: true, message: 'Missing "tool" parameter' });
      }

      const result = await mcpServer.executeToolDirect(tool, args || {});
      res.json(result);
    } catch (err: any) {
      res.status(500).json({
        error: true,
        message: err.message || 'Error executing tool',
      });
    }
  });

  // 3. MCP Tool Directory / JSON Schema Endpoint
  app.get('/api/mcp/tools', async (req: Request, res: Response) => {
    try {
      // Create a lightweight call to inspect tool schema
      const toolsHandler: any = (mcpServer.getSDKServer() as any)._requestHandlers?.get('tools/list');
      if (toolsHandler) {
        const schema = await toolsHandler({});
        return res.json(schema);
      }
      res.json({ message: 'MCP Tools Schema active' });
    } catch (err: any) {
      res.status(500).json({ error: true, message: err.message });
    }
  });

  // 4. Auth Validation Test Endpoint
  app.post('/api/auth/validate', async (req: Request, res: Response) => {
    try {
      const { type, credentials, storeUrl } = req.body;
      const tempAuth = new AuthManager({
        type: type || 'api_key',
        credentials: credentials || {},
        storeUrl: storeUrl || 'https://store.merchant.example.com',
      });
      const result = await tempAuth.validateCredentials();
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ valid: false, message: err.message });
    }
  });

  // 5. MCP Server-Sent Events (SSE) Transport for Agent Studio Integration
  app.get('/sse', async (req: Request, res: Response) => {
    const transport = new SSEServerTransport('/message', res);
    const sessionId = Math.random().toString(36).substring(2, 12);
    sseTransports.set(sessionId, transport);

    req.on('close', () => {
      sseTransports.delete(sessionId);
    });

    await mcpServer.getSDKServer().connect(transport);
  });

  app.post('/message', async (req: Request, res: Response) => {
    const sessionId = req.query.sessionId as string;
    const transport = sseTransports.get(sessionId) || Array.from(sseTransports.values())[0];
    if (transport) {
      await transport.handlePostMessage(req, res);
    } else {
      res.status(400).send('No active SSE session found');
    }
  });

  return { app, mcpServer, resilience, authManager, orderPrimitive, inventoryPrimitive, ticketPrimitive };
}
