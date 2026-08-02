import { OnboardingStatus, UserRole } from '../../generated/prisma/client';
import type { AuthenticatedUser } from '../types/authenticated-user';
import {
  canCreateBookingForLead,
  canCreateOwnBookingForLead,
  canViewBooking,
} from './booking.policy';
import type {
  BookingPolicySubject,
  LeadPolicySubject,
} from './policy-subjects';

describe('booking policy', () => {
  const assignedLead: LeadPolicySubject = {
    assignedToId: 'sales-1',
  };
  const unassignedLead: LeadPolicySubject = {
    assignedToId: 'sales-2',
  };

  it('allows ADMIN to create and view bookings', () => {
    const admin = createUser('admin-1', UserRole.ADMIN);

    expect(canCreateBookingForLead(admin, unassignedLead)).toBe(true);
    expect(canViewBooking(admin, createBooking('sales-2'))).toBe(true);
  });

  it('allows SALES_EXECUTIVE to create bookings only for assigned leads', () => {
    const salesExecutive = createUser('sales-1', UserRole.SALES_EXECUTIVE);

    expect(canCreateBookingForLead(salesExecutive, assignedLead)).toBe(true);
    expect(canCreateBookingForLead(salesExecutive, unassignedLead)).toBe(
      false,
    );
    expect(canCreateOwnBookingForLead(salesExecutive, assignedLead)).toBe(true);
  });

  it('denies own-booking creation helper to ADMIN', () => {
    const admin = createUser('admin-1', UserRole.ADMIN);

    expect(canCreateOwnBookingForLead(admin, assignedLead)).toBe(false);
  });

  it('allows SALES_EXECUTIVE to view own bookings', () => {
    const salesExecutive = createUser('sales-1', UserRole.SALES_EXECUTIVE);

    expect(canViewBooking(salesExecutive, createBooking('sales-1'))).toBe(true);
  });

  it('allows SALES_EXECUTIVE to view bookings through assigned lead context', () => {
    const salesExecutive = createUser('sales-1', UserRole.SALES_EXECUTIVE);

    expect(
      canViewBooking(salesExecutive, createBooking('sales-2', assignedLead)),
    ).toBe(true);
  });

  it('denies SALES_EXECUTIVE access to other bookings', () => {
    const salesExecutive = createUser('sales-1', UserRole.SALES_EXECUTIVE);

    expect(canViewBooking(salesExecutive, createBooking('sales-2'))).toBe(
      false,
    );
    expect(
      canViewBooking(salesExecutive, createBooking('sales-2', unassignedLead)),
    ).toBe(false);
  });

  function createUser(userId: string, role: UserRole): AuthenticatedUser {
    return {
      userId,
      email: `${userId}@example.com`,
      role,
      onboardingStatus: OnboardingStatus.ACTIVE,
    };
  }

  function createBooking(
    salesExecutiveId: string,
    lead?: LeadPolicySubject,
  ): BookingPolicySubject {
    return {
      salesExecutiveId,
      lead,
    };
  }
});
