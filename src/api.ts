import type {
  Config,
  Booking,
  Resource,
  Office,
  User,
  CreateBookingRequest,
  UpdateBookingRequest,
  ListBookingsParams,
  ListResourcesParams,
  PaginatedResponse,
} from './types.js';

class DeskbirdAPIError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public response?: unknown
  ) {
    super(message);
    this.name = 'DeskbirdAPIError';
  }
}

/**
 * Deskbird API Client
 * Based on https://developer.deskbird.com/
 */
export class DeskbirdClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(config: Config) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
  }

  private async request<T>(
    method: string,
    path: string,
    options: {
      params?: Record<string, string | number | undefined>;
      body?: unknown;
    } = {}
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);

    if (options.params) {
      for (const [key, value] of Object.entries(options.params)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };

    const response = await fetch(url.toString(), {
      method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      let errorBody: unknown;
      try {
        errorBody = await response.json();
      } catch {
        errorBody = await response.text();
      }

      if (response.status === 401) {
        throw new DeskbirdAPIError(401, 'Invalid API key. Check your DESKBIRD_API_KEY.', errorBody);
      }
      if (response.status === 403) {
        throw new DeskbirdAPIError(403, 'Not authorized to access this resource.', errorBody);
      }
      if (response.status === 429) {
        throw new DeskbirdAPIError(429, 'Rate limit exceeded. Please wait before retrying.', errorBody);
      }

      throw new DeskbirdAPIError(
        response.status,
        `API request failed: ${response.statusText}`,
        errorBody
      );
    }

    return response.json() as Promise<T>;
  }

  // ============ Offices ============

  async listOffices(): Promise<Office[]> {
    const response = await this.request<PaginatedResponse<Office>>('GET', '/offices', {
      params: { limit: 100 },
    });
    return response.data;
  }

  // ============ Resources ============

  async listResources(params: ListResourcesParams = {}): Promise<Resource[]> {
    const response = await this.request<PaginatedResponse<Resource>>('GET', '/resources', {
      params: {
        officeId: params.officeId,
        zoneId: params.zoneId,
        type: params.type,
        limit: params.limit || 100,
        offset: params.offset || 0,
      },
    });
    return response.data;
  }

  // ============ Users ============

  async listUsers(limit = 100, offset = 0): Promise<User[]> {
    const response = await this.request<PaginatedResponse<User>>('GET', '/users', {
      params: { limit, offset },
    });
    return response.data;
  }

  async getUser(userId: string): Promise<User> {
    return this.request<User>('GET', `/users/${userId}`);
  }

  // ============ Bookings ============

  async listBookings(params: ListBookingsParams): Promise<Booking[]> {
    const response = await this.request<PaginatedResponse<Booking>>('GET', '/bookings', {
      params: {
        startDate: params.startDate,
        endDate: params.endDate,
        userId: params.userId,
        officeId: params.officeId,
        resourceId: params.resourceId,
        zoneId: params.zoneId,
        status: params.status,
        limit: params.limit || 100,
        offset: params.offset || 0,
      },
    });
    return response.data;
  }

  async getBooking(bookingId: string): Promise<Booking> {
    return this.request<Booking>('GET', `/bookings/${bookingId}`);
  }

  async createBooking(data: CreateBookingRequest): Promise<Booking> {
    return this.request<Booking>('POST', '/bookings', { body: data });
  }

  async updateBooking(bookingId: string, data: UpdateBookingRequest): Promise<Booking> {
    return this.request<Booking>('PATCH', `/bookings/${bookingId}`, { body: data });
  }

  async cancelBooking(bookingId: string): Promise<void> {
    await this.request<void>('DELETE', `/bookings/${bookingId}`);
  }

  async checkIn(bookingId: string): Promise<Booking> {
    return this.request<Booking>('PATCH', `/bookings/${bookingId}/check-in`);
  }
}

export { DeskbirdAPIError };
