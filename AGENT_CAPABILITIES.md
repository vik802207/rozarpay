# Razorpay Agent Studio: Private Merchant Connector Capabilities Document

## Overview
This document specifies the capabilities, primitives, MCP tool interfaces, operational boundaries, and security design of the **Private Merchant Connector for WooCommerce & Merchant Tools**, built for Razorpay Agent Studio.

---

## 1. What the Agent CAN Do

### 🛒 A. Order Management & Razorpay Payment Sync Primitives
* **`woocommerce_list_orders`**:
  * Filter merchant orders by fulfillment status (`pending`, `processing`, `completed`, `on-hold`, `cancelled`, `refunded`, `failed`).
  * Filter orders by **Razorpay Payment Status** (`paid`, `unpaid`, `refunded`, `partially_refunded`).
  * Filter by customer email address or creation date range (`startDate`, `endDate`).
  * Paginate results with custom page size limits (`limit`, `page`).
* **`woocommerce_get_order`**:
  * Retrieve detailed single-order state by Order ID (`ord_1001`) or WooCommerce Order Number (`WC-1001`).
  * Access line item breakdown (SKUs, quantities, line totals, prices).
  * Read shipping & billing addresses, customer details, and linked **Razorpay Payment ID** (`pay_...`) & **Razorpay Order ID** (`order_...`).
* **`woocommerce_search_orders`**:
  * Full-text search across customer name, email address, shipping city, SKU, or exact Razorpay Payment ID.

### 📦 B. Inventory & Product Stock Monitoring Primitives
* **`woocommerce_list_inventory`**:
  * List merchant inventory items and product catalog.
  * Filter by stock status (`instock`, `outofstock`, `onbackorder`) or product category.
  * **Low-Stock Alert Filtering**: Pass `lowStockOnly: true` to instantly query items operating at or below their merchant reorder threshold.
* **`woocommerce_get_product`**:
  * Retrieve detailed product metadata, unit price, regular price, sale price, stock quantity, and product variant attributes by SKU (e.g. `RZP-SND-01`) or Product ID.
* **`woocommerce_search_inventory`**:
  * Search product inventory using free-text queries matching product title, category, description, or SKU.

### 🎧 C. Merchant Customer Service Integration Primitives
* **`merchant_list_tickets`**:
  * Query merchant support tickets (Freshdesk style integration) filtered by status (`open`, `pending`, `resolved`, `closed`), priority (`low`, `medium`, `high`, `urgent`), or customer email.
* **`merchant_get_ticket`**:
  * Fetch complete ticket details including customer complaint description, linked WooCommerce Order ID, and resolution history.
* **`merchant_search_tickets`**:
  * Search support tickets by issue keywords or customer name/email.

### 🔐 D. Security, Resilience & Rate Limiting Controls
* **Dual Authentication Modes**:
  * **API-Key HMAC / Basic Auth**: Secures REST API calls using encrypted `ck_...` Consumer Key and `cs_...` Consumer Secret headers.
  * **OAuth 2.0 PKCE / Bearer Token**: Manages access tokens, token expiration timers, and automatic background refresh token exchange.
* **Resilience Engine**:
  * **Token Bucket Rate Limiter**: Enforces configurable rate limits (default: 60 req/min, burst max 15) to protect merchant store infrastructure.
  * **Exponential Backoff with Jitter**: Automatically retries HTTP 429 (Too Many Requests) or 5xx transient server errors with randomized exponential delays (up to 3 retries).
  * **Circuit Breaker Pattern**: Immediately halts outbound requests if 5 consecutive 5xx errors occur, preventing cascading API overload.
  * **Read Response Cache**: Caches read primitive responses with a 30-second TTL to optimize response latency and preserve merchant rate limit quota.

---

## 2. What the Agent CANNOT Do (Boundaries & Safety Limitations)

### ⛔ A. Destructive / Write Operations
* **No Direct Order Cancellation or Deletion**: The connector currently exposes read-only query primitives (`list`, `get`, `search`). It cannot unilaterally update order statuses, issue refunds, or delete customer records without explicit merchant workflow confirmation.
* **No Direct Inventory Modification**: The agent can inspect stock quantities and flag low-stock items, but cannot overwrite stock quantities or alter pricing on live store channels.

### ⛔ B. Sensitive Customer Data & Credential Protection
* **No Raw Payment Credentials Access**: The agent cannot access or read customer credit card numbers, CVVs, netbanking passwords, or raw UPI PINs. All payment verification relies strictly on Razorpay Payment Tokens and payment IDs (`pay_...`).
* **Credential Masking**: Consumer secrets, OAuth refresh tokens, and private API keys are stripped and sanitized from all logs, diagnostic endpoints, and Agent Studio responses.

### ⛔ C. Platform Scope Boundaries
* **Unsupported Third-Party Systems**: Deep ERP write-backs (e.g. SAP / Tally GL posting) are out of scope for this primitive set.
* **Synchronous Webhook Ingestion**: Webhooks from WooCommerce or Freshdesk are handled via polling or SSE triggers rather than bidirectional webhook endpoints in this initial version.

---

## 3. Summary Matrix

| Category | Capability | Primitive / Tool Name | Supported |
| :--- | :--- | :--- | :---: |
| **Orders** | Filter orders by status / date / payment | `woocommerce_list_orders` | ✅ |
| **Orders** | Fetch single order details & line items | `woocommerce_get_order` | ✅ |
| **Orders** | Search orders by Razorpay Payment ID | `woocommerce_search_orders` | ✅ |
| **Inventory** | List catalog & filter low stock items | `woocommerce_list_inventory` | ✅ |
| **Inventory** | Get product details by SKU / Product ID | `woocommerce_get_product` | ✅ |
| **Inventory** | Search product catalog by query | `woocommerce_search_inventory` | ✅ |
| **Support** | List & search merchant customer tickets | `merchant_list_tickets` | ✅ |
| **Auth** | API-Key HMAC & OAuth 2.0 Refresh | `AuthManager` | ✅ |
| **Resilience** | Token Bucket Rate Limit & Backoff | `RateLimiterAndResilience` | ✅ |
| **Protocol** | Model Context Protocol (MCP) JSON-RPC | `MerchantMCPServer` | ✅ |
| **Write** | Direct Stock Override / Refund Trigger | N/A (Read-Only Primitives) | ❌ |
