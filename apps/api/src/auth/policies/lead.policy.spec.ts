import { OnboardingStatus, UserRole } from '../../generated/prisma/client';
import type { AuthenticatedUser } from '../types/authenticated-user';
import {
  canAssignLead,
  canDeleteLead,
  canUpdateLead,
  canViewLead,
} from './lead.policy';
import type { LeadPolicySubject } from './policy-subjects';

describe('lead policy', () => {
  const assignedLead: LeadPolicySubject = {
    assignedToId: 'sales-1',
  };
  const unassignedLead: LeadPolicySubject = {
    assignedToId: 'sales-2',
  };

  it('allows ADMIN to view, update, delete, and assign leads', () => {
    const admin = createUser('admin-1', UserRole.ADMIN);

    expect(canViewLead(admin, assignedLead)).toBe(true);
    expect(canUpdateLead(admin, assignedLead)).toBe(true);
    expect(canDeleteLead(admin, assignedLead)).toBe(true);
    expect(canAssignLead(admin)).toBe(true);
  });

  it('allows SALES_EXECUTIVE to view and update assigned leads', () => {
    const salesExecutive = createUser('sales-1', UserRole.SALES_EXECUTIVE);

    expect(canViewLead(salesExecutive, assignedLead)).toBe(true);
    expect(canUpdateLead(salesExecutive, assignedLead)).toBe(true);
  });

  it('denies SALES_EXECUTIVE access to unassigned leads', () => {
    const salesExecutive = createUser('sales-1', UserRole.SALES_EXECUTIVE);

    expect(canViewLead(salesExecutive, unassignedLead)).toBe(false);
    expect(canUpdateLead(salesExecutive, unassignedLead)).toBe(false);
  });

  it('denies SALES_EXECUTIVE lead deletion and assignment', () => {
    const salesExecutive = createUser('sales-1', UserRole.SALES_EXECUTIVE);

    expect(canDeleteLead(salesExecutive, assignedLead)).toBe(false);
    expect(canAssignLead(salesExecutive)).toBe(false);
  });

  function createUser(userId: string, role: UserRole): AuthenticatedUser {
    return {
      userId,
      email: `${userId}@example.com`,
      role,
      onboardingStatus: OnboardingStatus.ACTIVE,
    };
  }
});
