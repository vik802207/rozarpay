"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createServer = createServer;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const sse_js_1 = require("@modelcontextprotocol/sdk/server/sse.js");
const AuthManager_1 = require("./auth/AuthManager");
const RateLimiter_1 = require("./resilience/RateLimiter");
const OrderPrimitive_1 = require("./primitives/OrderPrimitive");
const InventoryPrimitive_1 = require("./primitives/InventoryPrimitive");
const TicketPrimitive_1 = require("./primitives/TicketPrimitive");
const MCPServer_1 = require("./mcp/MCPServer");
function createServer(customAuthConfig) {
    const app = (0, express_1.default)();
    app.use((0, cors_1.default)());
    app.use(express_1.default.json());
    app.use(express_1.default.static(path_1.default.join(__dirname, '../public')));
    // Initialize Default Connector Stack
    const authConfig = customAuthConfig || {
        type: 'api_key',
        credentials: {
            consumerKey: 'ck_live_99a88b77c66d55e44',
            consumerSecret: 'cs_live_112233445566778899',
        },
        storeUrl: 'https://store.merchant.example.com',
    };
    const authManager = new AuthManager_1.AuthManager(authConfig);
    const resilience = new RateLimiter_1.RateLimiterAndResilience({
        maxRequestsPerMinute: 60,
        burstLimit: 15,
    });
    const orderPrimitive = new OrderPrimitive_1.OrderPrimitive(authManager, resilience);
    const inventoryPrimitive = new InventoryPrimitive_1.InventoryPrimitive(authManager, resilience);
    const ticketPrimitive = new TicketPrimitive_1.TicketPrimitive(authManager, resilience);
    const mcpServer = new MCPServer_1.MerchantMCPServer(orderPrimitive, inventoryPrimitive, ticketPrimitive, resilience, authManager);
    // Store active SSE transports for MCP Agent Studio connections
    let sseTransports = new Map();
    // 1. Live Connector Status Endpoint
    app.get('/api/status', (req, res) => {
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
    app.post('/api/mcp/tool', async (req, res) => {
        try {
            const { tool, arguments: args } = req.body;
            if (!tool) {
                return res.status(400).json({ error: true, message: 'Missing "tool" parameter' });
            }
            const result = await mcpServer.executeToolDirect(tool, args || {});
            res.json(result);
        }
        catch (err) {
            res.status(500).json({
                error: true,
                message: err.message || 'Error executing tool',
            });
        }
    });
    // 3. MCP Tool Directory / JSON Schema Endpoint
    app.get('/api/mcp/tools', async (req, res) => {
        try {
            // Create a lightweight call to inspect tool schema
            const toolsHandler = mcpServer.getSDKServer()._requestHandlers?.get('tools/list');
            if (toolsHandler) {
                const schema = await toolsHandler({});
                return res.json(schema);
            }
            res.json({ message: 'MCP Tools Schema active' });
        }
        catch (err) {
            res.status(500).json({ error: true, message: err.message });
        }
    });
    // 4. Auth Validation Test Endpoint
    app.post('/api/auth/validate', async (req, res) => {
        try {
            const { type, credentials, storeUrl } = req.body;
            const tempAuth = new AuthManager_1.AuthManager({
                type: type || 'api_key',
                credentials: credentials || {},
                storeUrl: storeUrl || 'https://store.merchant.example.com',
            });
            const result = await tempAuth.validateCredentials();
            res.json(result);
        }
        catch (err) {
            res.status(400).json({ valid: false, message: err.message });
        }
    });
    // 5. MCP Server-Sent Events (SSE) Transport for Agent Studio Integration
    app.get('/sse', async (req, res) => {
        const transport = new sse_js_1.SSEServerTransport('/message', res);
        const sessionId = Math.random().toString(36).substring(2, 12);
        sseTransports.set(sessionId, transport);
        req.on('close', () => {
            sseTransports.delete(sessionId);
        });
        await mcpServer.getSDKServer().connect(transport);
    });
    app.post('/message', async (req, res) => {
        const sessionId = req.query.sessionId;
        const transport = sseTransports.get(sessionId) || Array.from(sseTransports.values())[0];
        if (transport) {
            await transport.handlePostMessage(req, res);
        }
        else {
            res.status(400).send('No active SSE session found');
        }
    });
    return { app, mcpServer, resilience, authManager, orderPrimitive, inventoryPrimitive, ticketPrimitive };
}
