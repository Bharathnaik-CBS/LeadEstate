import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { ActivityEventsService } from '../activity-events/activity-events.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import {
  OnboardingStatus,
  Prisma,
  UserRole,
} from '../generated/prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { DriversService } from './drivers.service';

describe('DriversService', () => {
  let prisma: {
    driver: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
  };
  let activityEventsService: {
    log: jest.Mock;
  };
  let service: DriversService;

  beforeEach(() => {
    prisma = {
      driver: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };
    activityEventsService = {
      log: jest.fn().mockResolvedValue({ id: 'event-1' }),
    };
    service = new DriversService(
      prisma as unknown as PrismaService,
      activityEventsService as unknown as ActivityEventsService,
    );
  });

  it('logs driver.created after creating a driver', async () => {
    prisma.driver.create.mockResolvedValue(createDriver());

    await service.create(
      {
        fullName: 'Driver One',
        phone: '9876543210',
        licenseNumber: 'DL-1234',
      },
      createUser(UserRole.ADMIN),
    );

    expect(activityEventsService.log).toHaveBeenCalledWith({
      action: 'driver.created',
      targetType: 'Driver',
      targetId: 'driver-1',
      actorId: 'user-1',
      metadata: {
        driverId: 'driver-1',
        fullName: 'Driver One',
        phone: '9876543210',
        licenseNumber: 'DL-1234',
        isActive: true,
      },
    });
  });

  it('filters driver lists to active records for sales executives', async () => {
    prisma.driver.findMany.mockResolvedValue([]);

    await service.findAll(createUser(UserRole.SALES_EXECUTIVE));

    expect(prisma.driver.findMany).toHaveBeenCalledWith({
      where: {
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  });

  it('allows admins to list active and inactive drivers', async () => {
    prisma.driver.findMany.mockResolvedValue([]);

    await service.findAll(createUser(UserRole.ADMIN));

    expect(prisma.driver.findMany).toHaveBeenCalledWith({
      where: undefined,
      orderBy: {
        createdAt: 'desc',
      },
    });
  });

  it('allows site visit coordinators to list active and inactive drivers', async () => {
    prisma.driver.findMany.mockResolvedValue([]);

    await service.findAll(createUser(UserRole.SITE_VISIT_COORDINATOR));

    expect(prisma.driver.findMany).toHaveBeenCalledWith({
      where: undefined,
      orderBy: {
        createdAt: 'desc',
      },
    });
  });

  it('hides inactive drivers from sales executives when fetching by id', async () => {
    prisma.driver.findFirst.mockResolvedValue(null);

    await expect(
      service.findOne('driver-1', createUser(UserRole.SALES_EXECUTIVE)),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.driver.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'driver-1',
        isActive: true,
      },
    });
  });

  it('allows site visit coordinators to fetch inactive drivers by id', async () => {
    prisma.driver.findUnique.mockResolvedValue(createDriver({ isActive: false }));

    await service.findOne('driver-1', createUser(UserRole.SITE_VISIT_COORDINATOR));

    expect(prisma.driver.findUnique).toHaveBeenCalledWith({
      where: {
        id: 'driver-1',
      },
    });
  });

  it('returns a bad request when license number is duplicated', async () => {
    prisma.driver.findUnique.mockResolvedValue({ id: 'driver-1' });
    prisma.driver.update.mockRejectedValue(
      createUniqueConstraintError('licenseNumber'),
    );

    await expect(
      service.update('driver-1', {
        licenseNumber: 'DL-1234',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('logs driver.updated after updating a driver', async () => {
    prisma.driver.findUnique.mockResolvedValue(createDriver());
    prisma.driver.update.mockResolvedValue(
      createDriver({
        fullName: 'Driver Prime',
      }),
    );

    await service.update(
      'driver-1',
      {
        fullName: 'Driver Prime',
      },
      createUser(UserRole.ADMIN),
    );

    expect(activityEventsService.log).toHaveBeenCalledWith({
      action: 'driver.updated',
      targetType: 'Driver',
      targetId: 'driver-1',
      actorId: 'user-1',
      metadata: {
        driverId: 'driver-1',
        fullName: 'Driver Prime',
        phone: '9876543210',
        licenseNumber: 'DL-1234',
        isActive: true,
      },
    });
  });

  it('logs driver.updated after updating driver active status', async () => {
    prisma.driver.findUnique.mockResolvedValue(createDriver());
    prisma.driver.update.mockResolvedValue(
      createDriver({
        isActive: false,
      }),
    );

    await service.updateStatus(
      'driver-1',
      {
        isActive: false,
      },
      createUser(UserRole.ADMIN),
    );

    expect(activityEventsService.log).toHaveBeenCalledWith({
      action: 'driver.updated',
      targetType: 'Driver',
      targetId: 'driver-1',
      actorId: 'user-1',
      metadata: {
        driverId: 'driver-1',
        fullName: 'Driver One',
        phone: '9876543210',
        licenseNumber: 'DL-1234',
        isActive: false,
        previousIsActive: true,
      },
    });
  });

  function createUser(role: UserRole): AuthenticatedUser {
    return {
      userId: 'user-1',
      email: 'user@example.com',
      role,
      onboardingStatus: OnboardingStatus.ACTIVE,
    };
  }

  function createUniqueConstraintError(field: string) {
    return new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      {
        code: 'P2002',
        clientVersion: 'test',
        meta: {
          target: [field],
        },
      },
    );
  }

  function createDriver(
    overrides: Partial<{
      fullName: string;
      isActive: boolean;
    }> = {},
  ) {
    return {
      id: 'driver-1',
      fullName: 'Driver One',
      phone: '9876543210',
      licenseNumber: 'DL-1234',
      notes: null,
      isActive: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      ...overrides,
    };
  }
});
