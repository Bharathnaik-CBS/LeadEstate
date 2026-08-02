import { Prisma } from '../generated/prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { ActivityEventsService } from './activity-events.service';

describe('ActivityEventsService', () => {
  let prisma: {
    activityEvent: {
      create: jest.Mock;
      findMany: jest.Mock;
    };
  };
  let service: ActivityEventsService;

  beforeEach(() => {
    prisma = {
      activityEvent: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
    };
    service = new ActivityEventsService(prisma as unknown as PrismaService);
  });

  it('creates an activity event through PrismaService by default', async () => {
    const metadata = {
      status: {
        from: 'NEW',
        to: 'BOOKED',
      },
    };
    prisma.activityEvent.create.mockResolvedValue({ id: 'event-1' });

    await service.log({
      action: 'lead.status_changed',
      targetType: 'Lead',
      targetId: 'lead-1',
      actorId: 'user-1',
      metadata,
    });

    expect(prisma.activityEvent.create).toHaveBeenCalledWith({
      data: {
        action: 'lead.status_changed',
        targetType: 'Lead',
        targetId: 'lead-1',
        actorId: 'user-1',
        metadata,
      },
    });
  });

  it('creates an activity event through a transaction client when provided', async () => {
    const tx = {
      activityEvent: {
        create: jest.fn().mockResolvedValue({ id: 'event-1' }),
      },
    };

    await service.log(
      {
        action: 'booking.created',
        targetType: 'Booking',
        targetId: 'booking-1',
      },
      tx as unknown as Prisma.TransactionClient,
    );

    expect(tx.activityEvent.create).toHaveBeenCalledWith({
      data: {
        action: 'booking.created',
        targetType: 'Booking',
        targetId: 'booking-1',
      },
    });
    expect(prisma.activityEvent.create).not.toHaveBeenCalled();
  });
});
