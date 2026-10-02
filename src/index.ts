import dotenv from 'dotenv';
import { createServer } from './server';

dotenv.config();

const PORT = process.env.PORT || 3000;

const { app } = createServer();

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
