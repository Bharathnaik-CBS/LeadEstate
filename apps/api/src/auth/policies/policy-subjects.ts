import type { Booking, Lead } from '../../generated/prisma/client';

export type LeadPolicySubject = Pick<Lead, 'assignedToId'>;

export type BookingPolicySubject = Pick<Booking, 'salesExecutiveId'> & {
  lead?: LeadPolicySubject | null;
};
