import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivityEventsService } from '../activity-events/activity-events.service';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { Prisma, UserRole } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleStatusDto } from './dto/update-vehicle-status.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';

@Injectable()
export class VehiclesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityEventsService: ActivityEventsService,
  ) {}

  async create(createVehicleDto: CreateVehicleDto, user?: AuthenticatedUser) {
    try {
      const vehicle = await this.prisma.vehicle.create({
        data: {
          registrationNumber: this.requireText(
            createVehicleDto.registrationNumber,
            'Registration number is required',
          ),
          name: this.cleanText(createVehicleDto.name),
          type: this.cleanText(createVehicleDto.type),
          capacity: createVehicleDto.capacity,
          notes: this.cleanText(createVehicleDto.notes),
        },
      });

      await this.activityEventsService.log({
        action: 'vehicle.created',
        targetType: 'Vehicle',
        targetId: vehicle.id,
        actorId: user?.userId,
        metadata: this.toVehicleMetadata(vehicle),
      });

      return vehicle;
    } catch (error) {
      this.throwIfDuplicateRegistration(error);
      throw error;
    }
  }

  findAll(user: AuthenticatedUser) {
    return this.prisma.vehicle.findMany({
      where:
        user.role === UserRole.ADMIN ||
        user.role === UserRole.SITE_VISIT_COORDINATOR
          ? undefined
          : {
              isActive: true,
            },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const vehicle =
      user.role === UserRole.ADMIN ||
      user.role === UserRole.SITE_VISIT_COORDINATOR
        ? await this.prisma.vehicle.findUnique({
            where: {
              id,
            },
          })
        : await this.prisma.vehicle.findFirst({
            where: {
              id,
              isActive: true,
            },
          });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    return vehicle;
  }

  async update(
    id: string,
    updateVehicleDto: UpdateVehicleDto,
    user?: AuthenticatedUser,
  ) {
    const vehicle = await this.ensureVehicleExists(id);

    try {
      const updatedVehicle = await this.prisma.vehicle.update({
        where: {
          id,
        },
        data: this.toUpdateData(updateVehicleDto),
      });

      await this.activityEventsService.log({
        action: 'vehicle.updated',
        targetType: 'Vehicle',
        targetId: updatedVehicle.id,
        actorId: user?.userId,
        metadata: this.toVehicleMetadata(updatedVehicle, {
          ...(vehicle.isActive !== updatedVehicle.isActive
            ? { previousIsActive: vehicle.isActive }
            : {}),
        }),
      });

      return updatedVehicle;
    } catch (error) {
      this.throwIfDuplicateRegistration(error);
      throw error;
    }
  }

  async updateStatus(
    id: string,
    updateVehicleStatusDto: UpdateVehicleStatusDto,
    user?: AuthenticatedUser,
  ) {
    const vehicle = await this.ensureVehicleExists(id);

    const updatedVehicle = await this.prisma.vehicle.update({
      where: {
        id,
      },
      data: {
        isActive: updateVehicleStatusDto.isActive,
      },
    });

    await this.activityEventsService.log({
      action: 'vehicle.updated',
      targetType: 'Vehicle',
      targetId: updatedVehicle.id,
      actorId: user?.userId,
      metadata: this.toVehicleMetadata(updatedVehicle, {
        previousIsActive: vehicle.isActive,
      }),
    });

    return updatedVehicle;
  }

  private async ensureVehicleExists(id: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: {
        id,
      },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    return vehicle;
  }

  private toUpdateData(
    vehicleDto: UpdateVehicleDto,
  ): Prisma.VehicleUpdateInput {
    const data: Prisma.VehicleUpdateInput = {};

    if (vehicleDto.registrationNumber !== undefined) {
      data.registrationNumber = this.requireText(
        vehicleDto.registrationNumber,
        'Registration number is required',
      );
    }

    if (vehicleDto.name !== undefined) {
      data.name = this.cleanText(vehicleDto.name) ?? null;
    }

    if (vehicleDto.type !== undefined) {
      data.type = this.cleanText(vehicleDto.type) ?? null;
    }

    if (vehicleDto.capacity !== undefined) {
      data.capacity = vehicleDto.capacity;
    }

    if (vehicleDto.notes !== undefined) {
      data.notes = this.cleanText(vehicleDto.notes) ?? null;
    }

    return data;
  }

  private throwIfDuplicateRegistration(error: unknown): never | void {
    if (this.isUniqueConstraintError(error, 'registrationNumber')) {
      throw new BadRequestException('Vehicle registration number already exists');
    }
  }

  private isUniqueConstraintError(error: unknown, field: string) {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== 'P2002'
    ) {
      return false;
    }

    const target = error.meta?.target;

    if (Array.isArray(target)) {
      return target.includes(field);
    }

    return target === field;
  }

  private requireText(value: string, message: string) {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      throw new BadRequestException(message);
    }

    return trimmedValue;
  }

  private cleanText(value?: string) {
    const trimmedValue = value?.trim();
    return trimmedValue || undefined;
  }

  private toVehicleMetadata(
    vehicle: {
      id: string;
      registrationNumber: string;
      name: string | null;
      type: string | null;
      isActive: boolean;
    },
    extra: Prisma.InputJsonObject = {},
  ): Prisma.InputJsonObject {
    return {
      vehicleId: vehicle.id,
      registrationNumber: vehicle.registrationNumber,
      name: vehicle.name,
      type: vehicle.type,
      isActive: vehicle.isActive,
      ...extra,
    };
  }
}
