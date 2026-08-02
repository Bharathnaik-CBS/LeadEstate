import { UserRole } from '../../generated/prisma/client';
import type { AuthenticatedUser } from '../types/authenticated-user';

export function canUseSalesSelfService(user: AuthenticatedUser): boolean {
  return user.role === UserRole.SALES_EXECUTIVE;
}
