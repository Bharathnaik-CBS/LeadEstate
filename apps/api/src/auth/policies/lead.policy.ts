import { UserRole } from '../../generated/prisma/client';
import type { AuthenticatedUser } from '../types/authenticated-user';
import type { LeadPolicySubject } from './policy-subjects';

export function canViewLead(
  user: AuthenticatedUser,
  lead: LeadPolicySubject,
): boolean {
  if (isAdmin(user)) {
    return true;
  }

  return isSalesExecutive(user) && isLeadAssignedToUser(user, lead);
}

export function canUpdateLead(
  user: AuthenticatedUser,
  lead: LeadPolicySubject,
): boolean {
  if (isAdmin(user)) {
    return true;
  }

  return isSalesExecutive(user) && isLeadAssignedToUser(user, lead);
}

export function canDeleteLead(
  user: AuthenticatedUser,
  _lead: LeadPolicySubject,
): boolean {
  return isAdmin(user);
}

export function canAssignLead(user: AuthenticatedUser): boolean {
  return isAdmin(user);
}

export function canViewAssignedLeads(user: AuthenticatedUser): boolean {
  return isSalesExecutive(user);
}

export function canUpdateAssignedLead(
  user: AuthenticatedUser,
  lead: LeadPolicySubject,
): boolean {
  return isSalesExecutive(user) && isLeadAssignedToUser(user, lead);
}

export function isLeadAssignedToUser(
  user: AuthenticatedUser,
  lead: LeadPolicySubject,
): boolean {
  return lead.assignedToId === user.userId;
}

function isAdmin(user: AuthenticatedUser): boolean {
  return user.role === UserRole.ADMIN;
}

function isSalesExecutive(user: AuthenticatedUser): boolean {
  return user.role === UserRole.SALES_EXECUTIVE;
}
