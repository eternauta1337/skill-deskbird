/**
 * Deskbird API Types
 * Based on https://developer.deskbird.com/
 */

// Resource types available in Deskbird
export type ResourceType = 'flexDesk' | 'meetingRoom' | 'parking' | 'other';

// Booking status
export type BookingStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';

// Check-in status
export type CheckInStatus = 'pending' | 'checkedIn' | 'checkedOut' | 'noShow';

export interface Office {
  id: string;
  name: string;
  timezone?: string;
}

export interface Zone {
  id: string;
  name: string;
  officeId: string;
}

export interface Resource {
  id: string;
  name: string;
  type: ResourceType;
  officeId: string;
  zoneId?: string;
  floorId?: string;
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role?: string;
  primaryOfficeId?: string;
  status?: string;
  profileImage?: string;
}

export interface UserEmbedded {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface ResourceEmbedded {
  id: string;
  name: string;
  type: ResourceType;
}

export interface Booking {
  id: string;
  userId: string;
  resourceId: string;
  officeId: string;
  zoneId?: string;
  floorId?: string;
  startTime: string; // ISO 8601
  endTime: string; // ISO 8601
  status: BookingStatus;
  checkInStatus: CheckInStatus;
  isAnonymousBooking: boolean;
  anonymized: boolean;
  createdAt: string;
  updatedAt: string;
  cancelledBy?: string;
  cancelledByUserId?: string;
  user?: UserEmbedded;
  resource?: ResourceEmbedded;
}

export interface CreateBookingRequest {
  userId: string;
  resourceId: string;
  startTime: string; // ISO 8601
  endTime: string; // ISO 8601
  isAnonymousBooking?: boolean;
}

export interface UpdateBookingRequest {
  userId?: string;
  resourceId?: string;
  startTime?: string;
  endTime?: string;
  isAnonymousBooking?: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface ListBookingsParams {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  userId?: string;
  officeId?: string;
  resourceId?: string;
  zoneId?: string;
  status?: BookingStatus;
  limit?: number;
  offset?: number;
}

export interface ListResourcesParams {
  officeId?: string;
  zoneId?: string;
  type?: ResourceType;
  limit?: number;
  offset?: number;
}

export interface Config {
  apiKey: string;
  baseUrl: string;
  defaultOfficeId?: string;
  timezone: string;
}
