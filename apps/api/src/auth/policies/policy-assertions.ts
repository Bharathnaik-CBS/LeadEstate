import { ForbiddenException } from '@nestjs/common';

export function throwForbiddenUnless(
  condition: unknown,
  message = 'Forbidden',
): asserts condition {
  if (!condition) {
    throw new ForbiddenException(message);
  }
}
