"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TicketPrimitive = void 0;
const mockDataStore_1 = require("../mock-server/mockDataStore");
class TicketPrimitive {
    authManager;
    resilience;
    mockStore;
    constructor(authManager, resilience, mockTickets) {
        this.authManager = authManager;
        this.resilience = resilience;
        this.mockStore = mockTickets || [...mockDataStore_1.INITIAL_MOCK_TICKETS];
    }
    /**
     * List merchant support tickets with filters for status, priority, customer email, or associated order ID.
     */
    async list(params = {}) {
        const cacheKey = `tickets_list_${JSON.stringify(params)}`;
        const res = await this.resilience.executeWithResilience(async () => {
            const authValidation = await this.authManager.validateCredentials();
            if (!authValidation.valid) {
                throw new Error(`Authentication Failed: ${authValidation.message}`);
            }
            let filtered = [...this.mockStore];
            if (params.status) {
                filtered = filtered.filter((t) => t.status === params.status);
            }
            if (params.priority) {
                filtered = filtered.filter((t) => t.priority === params.priority);
            }
            if (params.customerEmail) {
                const emailQuery = params.customerEmail.toLowerCase().trim();
                filtered = filtered.filter((t) => t.customerEmail.toLowerCase().includes(emailQuery));
            }
            if (params.orderId) {
                filtered = filtered.filter((t) => t.associatedOrderId === params.orderId);
            }
            // Pagination
            const limit = Math.max(1, Math.min(100, params.limit || 10));
            const page = Math.max(1, params.page || 1);
            const total = filtered.length;
            const totalPages = Math.ceil(total / limit) || 1;
            const startIndex = (page - 1) * limit;
            const paginatedData = filtered.slice(startIndex, startIndex + limit);
            const statusMetrics = this.resilience.getStatus();
            return {
                data: paginatedData,
                pagination: {
                    total,
                    page,
                    limit,
                    totalPages,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1,
                },
                metadata: {
                    source: 'Freshdesk / Merchant Support Ticket API',
                    fetchedAt: new Date().toISOString(),
                    cached: false,
                    executionTimeMs: 0,
                    rateLimitRemaining: statusMetrics.tokensRemaining,
                },
            };
        }, cacheKey);
        return res.data;
    }
    /**
     * Get ticket by ID or Ticket Number
     */
    async get(ticketId) {
        const cacheKey = `ticket_get_${ticketId}`;
        const result = await this.resilience.executeWithResilience(async () => {
            const authValidation = await this.authManager.validateCredentials();
            if (!authValidation.valid) {
                throw new Error(`Authentication Failed: ${authValidation.message}`);
            }
            const ticket = this.mockStore.find((t) => t.id === ticketId || t.ticketNumber.toLowerCase() === ticketId.toLowerCase());
            if (!ticket) {
                throw new Error(`Support ticket not found for ID/Number: '${ticketId}'`);
            }
            return ticket;
        }, cacheKey);
        return result.data;
    }
    /**
     * Search support tickets by query (subject, description, customer email/name, or ticket number)
     */
    async search(params) {
        const query = params.query.toLowerCase().trim();
        const cacheKey = `tickets_search_${query}_${params.page || 1}_${params.limit || 10}`;
        const res = await this.resilience.executeWithResilience(async () => {
            const authValidation = await this.authManager.validateCredentials();
            if (!authValidation.valid) {
                throw new Error(`Authentication Failed: ${authValidation.message}`);
            }
            const matched = this.mockStore.filter((t) => {
                return (t.ticketNumber.toLowerCase().includes(query) ||
                    t.subject.toLowerCase().includes(query) ||
                    t.description.toLowerCase().includes(query) ||
                    t.customerEmail.toLowerCase().includes(query) ||
                    t.customerName.toLowerCase().includes(query) ||
                    (t.associatedOrderId && t.associatedOrderId.toLowerCase().includes(query)));
            });
            const limit = Math.max(1, Math.min(100, params.limit || 10));
            const page = Math.max(1, params.page || 1);
            const total = matched.length;
            const totalPages = Math.ceil(total / limit) || 1;
            const startIndex = (page - 1) * limit;
            const paginatedData = matched.slice(startIndex, startIndex + limit);
            const statusMetrics = this.resilience.getStatus();
            return {
                data: paginatedData,
                pagination: {
                    total,
                    page,
                    limit,
                    totalPages,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1,
                },
                metadata: {
                    source: 'Freshdesk / Support Ticket Search API',
                    fetchedAt: new Date().toISOString(),
                    cached: false,
                    executionTimeMs: 0,
                    rateLimitRemaining: statusMetrics.tokensRemaining,
                },
            };
        }, cacheKey);
        return res.data;
    }
}
exports.TicketPrimitive = TicketPrimitive;
