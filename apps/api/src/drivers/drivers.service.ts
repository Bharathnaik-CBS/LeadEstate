import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivityEventsService } from '../activity-events/activity-events.service';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { Prisma, UserRole } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverStatusDto } from './dto/update-driver-status.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';

@Injectable()
export class DriversService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityEventsService: ActivityEventsService,
  ) {}

  async create(createDriverDto: CreateDriverDto, user?: AuthenticatedUser) {
    try {
      const driver = await this.prisma.driver.create({
        data: {
          fullName: this.requireText(createDriverDto.fullName, 'Driver name is required'),
          phone: this.requireText(createDriverDto.phone, 'Driver phone is required'),
          licenseNumber: this.cleanText(createDriverDto.licenseNumber),
          notes: this.cleanText(createDriverDto.notes),
        },
      });

      await this.activityEventsService.log({
        action: 'driver.created',
        targetType: 'Driver',
        targetId: driver.id,
        actorId: user?.userId,
        metadata: this.toDriverMetadata(driver),
      });

      return driver;
    } catch (error) {
      this.throwIfDuplicateLicense(error);
      throw error;
    }
  }

  findAll(user: AuthenticatedUser) {
    return this.prisma.driver.findMany({
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
    const driver =
      user.role === UserRole.ADMIN ||
      user.role === UserRole.SITE_VISIT_COORDINATOR
        ? await this.prisma.driver.findUnique({
            where: {
              id,
            },
          })
        : await this.prisma.driver.findFirst({
            where: {
              id,
              isActive: true,
            },
          });

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    return driver;
  }

  async update(
    id: string,
    updateDriverDto: UpdateDriverDto,
    user?: AuthenticatedUser,
  ) {
    const driver = await this.ensureDriverExists(id);

    try {
      const updatedDriver = await this.prisma.driver.update({
        where: {
          id,
        },
        data: this.toUpdateData(updateDriverDto),
      });

      await this.activityEventsService.log({
        action: 'driver.updated',
        targetType: 'Driver',
        targetId: updatedDriver.id,
        actorId: user?.userId,
        metadata: this.toDriverMetadata(updatedDriver, {
          ...(driver.isActive !== updatedDriver.isActive
            ? { previousIsActive: driver.isActive }
            : {}),
        }),
      });

      return updatedDriver;
    } catch (error) {
      this.throwIfDuplicateLicense(error);
      throw error;
    }
  }

  async updateStatus(
    id: string,
    updateDriverStatusDto: UpdateDriverStatusDto,
    user?: AuthenticatedUser,
  ) {
    const driver = await this.ensureDriverExists(id);

    const updatedDriver = await this.prisma.driver.update({
      where: {
        id,
      },
      data: {
        isActive: updateDriverStatusDto.isActive,
      },
    });

    await this.activityEventsService.log({
      action: 'driver.updated',
      targetType: 'Driver',
      targetId: updatedDriver.id,
      actorId: user?.userId,
      metadata: this.toDriverMetadata(updatedDriver, {
        previousIsActive: driver.isActive,
      }),
    });

    return updatedDriver;
  }

  private async ensureDriverExists(id: string) {
    const driver = await this.prisma.driver.findUnique({
      where: {
        id,
      },
    });

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    return driver;
  }

  private toUpdateData(driverDto: UpdateDriverDto): Prisma.DriverUpdateInput {
    const data: Prisma.DriverUpdateInput = {};

    if (driverDto.fullName !== undefined) {
      data.fullName = this.requireText(driverDto.fullName, 'Driver name is required');
    }

    if (driverDto.phone !== undefined) {
      data.phone = this.requireText(driverDto.phone, 'Driver phone is required');
    }

    if (driverDto.licenseNumber !== undefined) {
      data.licenseNumber = this.cleanText(driverDto.licenseNumber) ?? null;
    }

    if (driverDto.notes !== undefined) {
      data.notes = this.cleanText(driverDto.notes) ?? null;
    }

    return data;
  }

  private throwIfDuplicateLicense(error: unknown): never | void {
    if (this.isUniqueConstraintError(error, 'licenseNumber')) {
      throw new BadRequestException('Driver license number already exists');
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

  private toDriverMetadata(
    driver: {
      id: string;
      fullName: string;
      phone: string;
      licenseNumber: string | null;
      isActive: boolean;
    },
    extra: Prisma.InputJsonObject = {},
  ): Prisma.InputJsonObject {
    return {
      driverId: driver.id,
      fullName: driver.fullName,
      phone: driver.phone,
      licenseNumber: driver.licenseNumber,
      isActive: driver.isActive,
      ...extra,
    };
  }
}
