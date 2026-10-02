import { SupportTicket, ListTicketsParams, SearchParams, PaginatedResult } from '../types';
import { AuthManager } from '../auth/AuthManager';
import { RateLimiterAndResilience } from '../resilience/RateLimiter';
export declare class TicketPrimitive {
    private authManager;
    private resilience;
    private mockStore;
    constructor(authManager: AuthManager, resilience: RateLimiterAndResilience, mockTickets?: SupportTicket[]);
    /**
     * List merchant support tickets with filters for status, priority, customer email, or associated order ID.
     */
    list(params?: ListTicketsParams): Promise<PaginatedResult<SupportTicket>>;
    /**
     * Get ticket by ID or Ticket Number
     */
    get(ticketId: string): Promise<SupportTicket>;
    /**
     * Search support tickets by query (subject, description, customer email/name, or ticket number)
     */
    search(params: SearchParams): Promise<PaginatedResult<SupportTicket>>;
}
