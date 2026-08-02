import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { ActivityEventsService } from '../activity-events/activity-events.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import {
  OnboardingStatus,
  Prisma,
  UserRole,
} from '../generated/prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { VehiclesService } from './vehicles.service';

describe('VehiclesService', () => {
  let prisma: {
    vehicle: {
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
  let service: VehiclesService;

  beforeEach(() => {
    prisma = {
      vehicle: {
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
    service = new VehiclesService(
      prisma as unknown as PrismaService,
      activityEventsService as unknown as ActivityEventsService,
    );
  });

  it('logs vehicle.created after creating a vehicle', async () => {
    prisma.vehicle.create.mockResolvedValue(createVehicle());

    await service.create(
      {
        registrationNumber: 'KA-01-AB-1234',
        name: 'Shuttle 1',
        type: 'Van',
      },
      createUser(UserRole.ADMIN),
    );

    expect(activityEventsService.log).toHaveBeenCalledWith({
      action: 'vehicle.created',
      targetType: 'Vehicle',
      targetId: 'vehicle-1',
      actorId: 'user-1',
      metadata: {
        vehicleId: 'vehicle-1',
        registrationNumber: 'KA-01-AB-1234',
        name: 'Shuttle 1',
        type: 'Van',
        isActive: true,
      },
    });
  });

  it('filters vehicle lists to active records for sales executives', async () => {
    prisma.vehicle.findMany.mockResolvedValue([]);

    await service.findAll(createUser(UserRole.SALES_EXECUTIVE));

    expect(prisma.vehicle.findMany).toHaveBeenCalledWith({
      where: {
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  });

  it('allows admins to list active and inactive vehicles', async () => {
    prisma.vehicle.findMany.mockResolvedValue([]);

    await service.findAll(createUser(UserRole.ADMIN));

    expect(prisma.vehicle.findMany).toHaveBeenCalledWith({
      where: undefined,
      orderBy: {
        createdAt: 'desc',
      },
    });
  });

  it('allows site visit coordinators to list active and inactive vehicles', async () => {
    prisma.vehicle.findMany.mockResolvedValue([]);

    await service.findAll(createUser(UserRole.SITE_VISIT_COORDINATOR));

    expect(prisma.vehicle.findMany).toHaveBeenCalledWith({
      where: undefined,
      orderBy: {
        createdAt: 'desc',
      },
    });
  });

  it('hides inactive vehicles from sales executives when fetching by id', async () => {
    prisma.vehicle.findFirst.mockResolvedValue(null);

    await expect(
      service.findOne('vehicle-1', createUser(UserRole.SALES_EXECUTIVE)),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.vehicle.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'vehicle-1',
        isActive: true,
      },
    });
  });

  it('allows site visit coordinators to fetch inactive vehicles by id', async () => {
    prisma.vehicle.findUnique.mockResolvedValue(createVehicle({ isActive: false }));

    await service.findOne('vehicle-1', createUser(UserRole.SITE_VISIT_COORDINATOR));

    expect(prisma.vehicle.findUnique).toHaveBeenCalledWith({
      where: {
        id: 'vehicle-1',
      },
    });
  });

  it('returns a bad request when registration number is duplicated', async () => {
    prisma.vehicle.findUnique.mockResolvedValue({ id: 'vehicle-1' });
    prisma.vehicle.update.mockRejectedValue(
      createUniqueConstraintError('registrationNumber'),
    );

    await expect(
      service.update('vehicle-1', {
        registrationNumber: 'KA-01-AB-1234',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('logs vehicle.updated after updating a vehicle', async () => {
    prisma.vehicle.findUnique.mockResolvedValue(createVehicle());
    prisma.vehicle.update.mockResolvedValue(
      createVehicle({
        name: 'Shuttle Prime',
      }),
    );

    await service.update(
      'vehicle-1',
      {
        name: 'Shuttle Prime',
      },
      createUser(UserRole.ADMIN),
    );

    expect(activityEventsService.log).toHaveBeenCalledWith({
      action: 'vehicle.updated',
      targetType: 'Vehicle',
      targetId: 'vehicle-1',
      actorId: 'user-1',
      metadata: {
        vehicleId: 'vehicle-1',
        registrationNumber: 'KA-01-AB-1234',
        name: 'Shuttle Prime',
        type: 'Van',
        isActive: true,
      },
    });
  });

  it('logs vehicle.updated after updating vehicle active status', async () => {
    prisma.vehicle.findUnique.mockResolvedValue(createVehicle());
    prisma.vehicle.update.mockResolvedValue(
      createVehicle({
        isActive: false,
      }),
    );

    await service.updateStatus(
      'vehicle-1',
      {
        isActive: false,
      },
      createUser(UserRole.ADMIN),
    );

    expect(activityEventsService.log).toHaveBeenCalledWith({
      action: 'vehicle.updated',
      targetType: 'Vehicle',
      targetId: 'vehicle-1',
      actorId: 'user-1',
      metadata: {
        vehicleId: 'vehicle-1',
        registrationNumber: 'KA-01-AB-1234',
        name: 'Shuttle 1',
        type: 'Van',
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

  function createVehicle(
    overrides: Partial<{
      name: string | null;
      isActive: boolean;
    }> = {},
  ) {
    return {
      id: 'vehicle-1',
      registrationNumber: 'KA-01-AB-1234',
      name: 'Shuttle 1',
      type: 'Van',
      capacity: null,
      notes: null,
      isActive: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      ...overrides,
    };
  }
});
