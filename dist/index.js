"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const server_1 = require("./server");
dotenv_1.default.config();
const PORT = process.env.PORT || 3000;
const { app } = (0, server_1.createServer)();
app.listen(PORT, () => {
    console.log(`=============================================================`);
    console.log(`🚀 Razorpay Agent Studio Private Merchant Connector Online!`);
    console.log(`=============================================================`);
    console.log(`🌐 Web Dashboard & Playground: http://localhost:${PORT}`);
    console.log(`📡 MCP SSE Transport Endpoint: http://localhost:${PORT}/sse`);
    console.log(`🛠️ MCP Tools Schema API:       http://localhost:${PORT}/api/mcp/tools`);
    console.log(`📊 Live Status & Metrics:       http://localhost:${PORT}/api/status`);
    console.log(`=============================================================`);
});
