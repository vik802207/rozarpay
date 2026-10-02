# Razorpay Agent Studio: Private Merchant Connector (WooCommerce & Merchant Tools)

> **Forward Deployed Engineer (FDE) Application Submission**  
> Candidate Application Assignment for Razorpay Agent Studio

---

## Executive Summary
This repository contains a production-ready **Private Merchant Connector** designed for **Razorpay Agent Studio**. It connects AI agents directly to merchant e-commerce platforms (WooCommerce) and merchant customer support systems (Freshdesk/Zoho style context).

Built strictly according to the **Model Context Protocol (MCP)** specification, this connector enables Agent Studio agents to query orders, inspect inventory stock levels, search customer records by Razorpay Payment IDs, and view support tickets using resilient, rate-limited primitives.

---

## Key Architectural Highlights

```
                          ┌─────────────────────────────────────────┐
                          │          Razorpay Agent Studio          │
                          └────────────────────┬────────────────────┘
                                               │ MCP (JSON-RPC 2.0 / SSE)
                                               ▼
                          ┌─────────────────────────────────────────┐
                          │         Merchant MCP Server             │
                          │   (woocommerce_*, merchant_tickets)     │
                          └────────────────────┬────────────────────┘
                                               │
               ┌───────────────────────────────┴───────────────────────────────┐
               ▼                                                               ▼
┌─────────────────────────────┐                                 ┌─────────────────────────────┐
│  Authentication Handler     │                                 │    Resilience Engine        │
│  - API-Key (HMAC / Basic)   │                                 │  - Token Bucket Rate Limit  │
│  - OAuth 2.0 PKCE & Refresh │                                 │  - Exponential Backoff Jitter│
└──────────────┬──────────────┘                                 │  - Circuit Breaker & Cache  │
               │                                                └──────────────┬──────────────┘
               └───────────────────────────────┬───────────────────────────────┘
                                               │
                                               ▼
                          ┌─────────────────────────────────────────┐
                          │    Merchant Primitives Layer            │
                          │    - OrderPrimitive (List/Get/Search)   │
                          │    - InventoryPrimitive (Catalog/Stock) │
                          │    - TicketPrimitive (Support Context)  │
                          └────────────────────┬────────────────────┘
                                               │
                                               ▼
                          ┌─────────────────────────────────────────┐
                          │   WooCommerce & Merchant REST Sandbox   │
                          └─────────────────────────────────────────┘
```

1. **Model Context Protocol (MCP 1.0) Integration**: Fully compliant MCP JSON-RPC 2.0 and Server-Sent Events (SSE) server exposing tools with strict JSON Schema definitions.
2. **Dual Authentication Framework**: Supports WooCommerce API-Key (HMAC / Basic Auth) and OAuth 2.0 PKCE token refresh mechanics.
3. **Resilience & Rate Limit Engine**:
   - **Token Bucket Algorithm**: 60 req/min fill rate with burst capacity of 15 tokens.
   - **Exponential Backoff with Jitter**: Automatic retry handling for HTTP 429 & 5xx server errors.
   - **Circuit Breaker**: Auto-trips after 5 consecutive failures to protect merchant endpoints.
   - **Read Response Cache**: 30s TTL cache layer to preserve rate limit quota.
4. **Clean Primitives (List / Get / Search)**:
   - **Orders**: List by status, customer, date, or Razorpay payment status (`paid`, `unpaid`, `refunded`); get by ID; search by `pay_...` ID, SKU, or customer name.
   - **Inventory**: List catalog, filter low-stock items; get product details by SKU; search catalog.
   - **Support Tickets**: List, get, and search tickets linked to merchant orders.
5. **Interactive Web Dashboard & Playground UI**: Sleek dark-mode Web UI at `http://localhost:3000` with live token bucket gauge, credential validator, schema inspector, and MCP tool testing playground.

---

## Repository Structure

```
.
├── src/
│   ├── auth/
│   │   └── AuthManager.ts           # API Key HMAC & OAuth 2.0 Token Manager
│   ├── resilience/
│   │   └── RateLimiter.ts           # Token Bucket, Backoff Jitter & Circuit Breaker
│   ├── primitives/
│   │   ├── OrderPrimitive.ts        # Order list/get/search primitive implementation
│   │   ├── InventoryPrimitive.ts    # Inventory list/get/search primitive implementation
│   │   └── TicketPrimitive.ts       # Support ticket list/get/search primitive implementation
│   ├── mcp/
│   │   └── MCPServer.ts             # MCP Tool Registry & JSON-RPC execution handler
│   ├── mock-server/
│   │   └── mockDataStore.ts         # Rich mock dataset (WooCommerce orders, SKUs, Razorpay IDs)
│   ├── types/
│   │   └── index.ts                 # Domain models, schema & primitive interfaces
│   ├── server.ts                    # Express app with REST, MCP SSE & static file server
│   └── index.ts                     # Main application entry point
├── public/
│   ├── index.html                   # Agent Studio Dashboard & Playground UI
│   └── app.js                       # Interactive UI JS logic
├── tests/
│   └── connector.test.ts            # Vitest automated unit & integration test suite
├── scripts/
│   └── run-tests.ts                 # Standalone test runner
├── AGENT_CAPABILITIES.md            # Detailed Capabilities & Boundaries document
├── package.json
└── tsconfig.json
```

---

## Setup & Quick Start Instructions

### Prerequisites
- **Node.js**: `v18.0.0` or higher (tested on Node v24.19.0)
- **npm**: `v9.0.0` or higher

### Installation & Run

1. **Clone the Repository**:
   ```bash
   git clone <repository-url>
   cd razorpay
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Start the Merchant Connector & Playground Server**:
   ```bash
   npm start
   ```
   *Access the interactive Agent Studio Dashboard in your browser at:* `http://localhost:3000`

4. **Run Automated Test Suite**:
   ```bash
   npm test
   ```
   *Or execute standalone test runner:*
   ```bash
   npx ts-node scripts/run-tests.ts
   ```

---

## Exposed MCP Tools Reference

| MCP Tool Name | Description | Key Arguments |
| :--- | :--- | :--- |
| `woocommerce_list_orders` | List WooCommerce orders with filters | `status`, `razorpayStatus`, `customerEmail`, `startDate`, `endDate`, `limit`, `page` |
| `woocommerce_get_order` | Retrieve detailed order by ID or order number | `orderId` (e.g. `ord_1001` or `WC-1001`) |
| `woocommerce_search_orders` | Search orders by query, customer, SKU, or Razorpay Payment ID | `query` (e.g. `pay_Pz9K7jL1wE4m2v`), `limit`, `page` |
| `woocommerce_list_inventory` | List store inventory & filter low stock items | `category`, `stockStatus`, `lowStockOnly`, `limit`, `page` |
| `woocommerce_get_product` | Fetch product specs & stock levels by SKU or ID | `productIdOrSku` (e.g. `RZP-SND-01`) |
| `woocommerce_search_inventory` | Search product catalog by keywords | `query`, `limit`, `page` |
| `merchant_list_tickets` | Query support tickets associated with orders | `status`, `priority`, `customerEmail`, `orderId`, `limit`, `page` |
| `merchant_get_ticket` | Get ticket details by ID | `ticketId` (e.g. `tkt_7001`) |
| `merchant_search_tickets` | Search support tickets by description | `query` |

---

## Assumptions & Solution Limitations

### Assumptions
1. **Mock Data Sandbox Default**: For evaluation simplicity and zero external API dependencies, the connector runs against a built-in mock WooCommerce merchant dataset featuring 5 complete orders with Razorpay payment references (`pay_...`), 5 POS hardware SKUs, and 2 support tickets.
2. **Environment Variable Overrides**: Connecting to a live production WooCommerce store can be achieved by specifying environment variables (`STORE_URL`, `CONSUMER_KEY`, `CONSUMER_SECRET`) or configuring credentials via the Web Dashboard.

### Limitations & Long-term Enhancements
1. **Read-Only Scope**: The current primitive suite exposes read primitives (`list`, `get`, `search`). Write primitives (e.g., triggering a refund via Razorpay API or canceling an order) are intentionally gated behind confirmation workflows.
2. **Polling vs Webhook Subscriptions**: Real-time order change events use polling and SSE session streams. A long-term production deployment would register webhook endpoints (`/webhooks/woocommerce/order.updated`) to push instant change payloads to Agent Studio.

---

## License & Security Compliance
This project strictly avoids real customer data, real passwords, or private API keys. All mock data records use fictional names and synthetic IDs (`pay_Pz9K7jL1wE4m2v`).
