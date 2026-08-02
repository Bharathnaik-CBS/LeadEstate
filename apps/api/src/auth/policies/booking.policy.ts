import { UserRole } from '../../generated/prisma/client';
import type { AuthenticatedUser } from '../types/authenticated-user';
import { canViewLead, isLeadAssignedToUser } from './lead.policy';
import type {
  BookingPolicySubject,
  LeadPolicySubject,
} from './policy-subjects';

export function canCreateBookingForLead(
  user: AuthenticatedUser,
  lead: LeadPolicySubject,
): boolean {
  if (isAdmin(user)) {
    return true;
  }

  return isSalesExecutive(user) && isLeadAssignedToUser(user, lead);
}

export function canCreateOwnBookingForLead(
  user: AuthenticatedUser,
  lead: LeadPolicySubject,
): boolean {
  return isSalesExecutive(user) && isLeadAssignedToUser(user, lead);
}

export function canViewBooking(
  user: AuthenticatedUser,
  booking: BookingPolicySubject,
): boolean {
  if (isAdmin(user)) {
    return true;
  }

  if (!isSalesExecutive(user)) {
    return false;
  }

  if (booking.salesExecutiveId === user.userId) {
    return true;
  }

  return Boolean(booking.lead && canViewLead(user, booking.lead));
}

function isAdmin(user: AuthenticatedUser): boolean {
  return user.role === UserRole.ADMIN;
}

function isSalesExecutive(user: AuthenticatedUser): boolean {
  return user.role === UserRole.SALES_EXECUTIVE;
}
