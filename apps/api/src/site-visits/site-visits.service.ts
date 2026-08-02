import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivityEventsService } from '../activity-events/activity-events.service';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { throwForbiddenUnless } from '../auth/policies';
import { Prisma, SiteVisitStatus, UserRole } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CancelSiteVisitDto } from './dto/cancel-site-visit.dto';
import { CompleteSiteVisitDto } from './dto/complete-site-visit.dto';
import { CreateSiteVisitDto } from './dto/create-site-visit.dto';
import { UpdateSiteVisitDto } from './dto/update-site-visit.dto';

const siteVisitInclude = {
  lead: {
    select: {
      id: true,
      fullName: true,
      phone: true,
      status: true,
    },
  },
  customer: {
    select: {
      id: true,
      fullName: true,
      phone: true,
      status: true,
    },
  },
  project: {
    select: {
      id: true,
      projectName: true,
      location: true,
    },
  },
  booking: {
    select: {
      id: true,
      type: true,
      status: true,
      bookingDate: true,
    },
  },
  vehicle: true,
  driver: true,
  assignedTo: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
  createdBy: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
  startedBy: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  completedBy: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  cancelledBy: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
};

type SiteVisitAccessSubject = {
  assignedToId: string | null;
  createdById: string | null;
};

type SiteVisitLifecycleSubject = SiteVisitAccessSubject & {
  id: string;
  status: SiteVisitStatus;
};

@Injectable()
export class SiteVisitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityEventsService: ActivityEventsService,
  ) {}

  async create(createSiteVisitDto: CreateSiteVisitDto, user: AuthenticatedUser) {
    this.ensureSiteVisitTarget(createSiteVisitDto);
    await this.ensureReferencedRecordsExist(createSiteVisitDto);
    await this.ensureVehicleAssignable(createSiteVisitDto.vehicleId);
    await this.ensureDriverAssignable(createSiteVisitDto.driverId);

    const assignedToId =
      user.role === UserRole.SALES_EXECUTIVE
        ? user.userId
        : await this.resolveAssignedToId(createSiteVisitDto.assignedToId);

    const siteVisit = await this.prisma.siteVisit.create({
      data: {
        scheduledAt: new Date(createSiteVisitDto.scheduledAt),
        notes: this.cleanText(createSiteVisitDto.notes),
        leadId: createSiteVisitDto.leadId,
        customerId: createSiteVisitDto.customerId,
        projectId: createSiteVisitDto.projectId,
        bookingId: createSiteVisitDto.bookingId,
        vehicleId: createSiteVisitDto.vehicleId,
        driverId: createSiteVisitDto.driverId,
        assignedToId,
        createdById: user.userId,
      },
      include: siteVisitInclude,
    });

    await this.activityEventsService.log({
      action: 'site_visit.created',
      targetType: 'SiteVisit',
      targetId: siteVisit.id,
      actorId: user.userId,
      metadata: this.toSiteVisitMetadata(siteVisit),
    });

    return siteVisit;
  }

  findAll(user: AuthenticatedUser) {
    return this.prisma.siteVisit.findMany({
      where: this.getSiteVisitVisibilityWhere(user),
      orderBy: {
        scheduledAt: 'asc',
      },
      include: siteVisitInclude,
    });
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const siteVisit = await this.prisma.siteVisit.findUnique({
      where: {
        id,
      },
      include: siteVisitInclude,
    });

    if (!siteVisit) {
      throw new NotFoundException('Site visit not found');
    }

    throwForbiddenUnless(
      this.canAccessSiteVisit(user, siteVisit),
      'You are not allowed to view this site visit',
    );

    return siteVisit;
  }

  async update(
    id: string,
    updateSiteVisitDto: UpdateSiteVisitDto,
    user: AuthenticatedUser,
  ) {
    const siteVisit = await this.ensureSiteVisitExists(id);
    throwForbiddenUnless(
      this.canAccessSiteVisit(user, siteVisit),
      'You are not allowed to update this site visit',
    );

    if (
      siteVisit.status === SiteVisitStatus.COMPLETED ||
      siteVisit.status === SiteVisitStatus.CANCELLED
    ) {
      throw new BadRequestException(
        'Completed or cancelled site visits cannot be updated',
      );
    }

    await this.ensureReferencedRecordsExist(updateSiteVisitDto);
    await this.ensureVehicleAssignable(updateSiteVisitDto.vehicleId);
    await this.ensureDriverAssignable(updateSiteVisitDto.driverId);

    const data = await this.toUpdateData(updateSiteVisitDto, user);

    return this.prisma.siteVisit.update({
      where: {
        id,
      },
      data,
      include: siteVisitInclude,
    });
  }

  async start(id: string, user: AuthenticatedUser) {
    return this.transitionSiteVisit({
      id,
      user,
      allowedStatuses: [SiteVisitStatus.SCHEDULED],
      invalidMessage: 'Only scheduled site visits can be started',
      staleMessage: 'Site visit is no longer scheduled',
      data: {
        status: SiteVisitStatus.STARTED,
        startedAt: new Date(),
        startedById: user.userId,
      },
      activityAction: 'site_visit.started',
    });
  }

  async complete(
    id: string,
    completeSiteVisitDto: CompleteSiteVisitDto,
    user: AuthenticatedUser,
  ) {
    return this.transitionSiteVisit({
      id,
      user,
      allowedStatuses: [SiteVisitStatus.STARTED],
      invalidMessage: 'Only started site visits can be completed',
      staleMessage: 'Site visit is no longer started',
      data: {
        status: SiteVisitStatus.COMPLETED,
        completedAt: new Date(),
        completedById: user.userId,
        outcomeNotes:
          completeSiteVisitDto.outcomeNotes !== undefined
            ? this.cleanText(completeSiteVisitDto.outcomeNotes) ?? null
            : undefined,
      },
      activityAction: 'site_visit.completed',
    });
  }

  async cancel(
    id: string,
    cancelSiteVisitDto: CancelSiteVisitDto,
    user: AuthenticatedUser,
  ) {
    const cancellationReason = this.requireText(
      cancelSiteVisitDto.cancellationReason,
      'Cancellation reason is required',
    );

    return this.transitionSiteVisit({
      id,
      user,
      allowedStatuses: [SiteVisitStatus.SCHEDULED, SiteVisitStatus.STARTED],
      invalidMessage: 'Only scheduled or started site visits can be cancelled',
      staleMessage: 'Site visit can no longer be cancelled',
      data: {
        status: SiteVisitStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledById: user.userId,
        cancellationReason,
      },
      activityAction: 'site_visit.cancelled',
    });
  }

  private async transitionSiteVisit({
    id,
    user,
    allowedStatuses,
    invalidMessage,
    staleMessage,
    data,
    activityAction,
  }: {
    id: string;
    user: AuthenticatedUser;
    allowedStatuses: SiteVisitStatus[];
    invalidMessage: string;
    staleMessage: string;
    data: Prisma.SiteVisitUncheckedUpdateInput;
    activityAction: string;
  }) {
    const siteVisit = await this.ensureSiteVisitExists(id);
    throwForbiddenUnless(
      this.canAccessSiteVisit(user, siteVisit),
      'You are not allowed to update this site visit',
    );

    if (!allowedStatuses.includes(siteVisit.status)) {
      throw new BadRequestException(invalidMessage);
    }

    const transition = await this.prisma.siteVisit.updateMany({
      where: {
        id,
        status: {
          in: allowedStatuses,
        },
      },
      data,
    });

    if (transition.count !== 1) {
      throw new BadRequestException(staleMessage);
    }

    const updatedSiteVisit = await this.prisma.siteVisit.findUnique({
      where: {
        id,
      },
      include: siteVisitInclude,
    });

    if (updatedSiteVisit) {
      await this.activityEventsService.log({
        action: activityAction,
        targetType: 'SiteVisit',
        targetId: updatedSiteVisit.id,
        actorId: user.userId,
        metadata: this.toSiteVisitMetadata(
          updatedSiteVisit,
          this.toLifecycleMetadataExtra(updatedSiteVisit, activityAction),
        ),
      });
    }

    return updatedSiteVisit;
  }

  private getSiteVisitVisibilityWhere(
    user: AuthenticatedUser,
  ): Prisma.SiteVisitWhereInput | undefined {
    if (user.role === UserRole.ADMIN) {
      return undefined;
    }

    return {
      OR: [{ assignedToId: user.userId }, { createdById: user.userId }],
    };
  }

  private async ensureSiteVisitExists(
    id: string,
  ): Promise<SiteVisitLifecycleSubject> {
    const siteVisit = await this.prisma.siteVisit.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        status: true,
        assignedToId: true,
        createdById: true,
      },
    });

    if (!siteVisit) {
      throw new NotFoundException('Site visit not found');
    }

    return siteVisit;
  }

  private canAccessSiteVisit(
    user: AuthenticatedUser,
    siteVisit: SiteVisitAccessSubject,
  ) {
    if (user.role === UserRole.ADMIN) {
      return true;
    }

    return (
      siteVisit.assignedToId === user.userId ||
      siteVisit.createdById === user.userId
    );
  }

  private ensureSiteVisitTarget(siteVisitDto: {
    leadId?: string;
    customerId?: string;
  }) {
    if (siteVisitDto.leadId || siteVisitDto.customerId) {
      return;
    }

    throw new BadRequestException(
      'Site visit must be linked to a lead or customer',
    );
  }

  private async ensureReferencedRecordsExist(siteVisitDto: {
    leadId?: string;
    customerId?: string;
    projectId?: string;
    bookingId?: string;
  }) {
    if (siteVisitDto.leadId) {
      await this.ensureLeadExists(siteVisitDto.leadId);
    }

    if (siteVisitDto.customerId) {
      await this.ensureCustomerExists(siteVisitDto.customerId);
    }

    if (siteVisitDto.projectId) {
      await this.ensureProjectExists(siteVisitDto.projectId);
    }

    if (siteVisitDto.bookingId) {
      await this.ensureBookingExists(siteVisitDto.bookingId);
    }
  }

  private async ensureLeadExists(leadId: string) {
    const lead = await this.prisma.lead.findUnique({
      where: {
        id: leadId,
      },
      select: {
        id: true,
      },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }
  }

  private async ensureCustomerExists(customerId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: {
        id: customerId,
      },
      select: {
        id: true,
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
  }

  private async ensureProjectExists(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: {
        id: projectId,
      },
      select: {
        id: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }
  }

  private async ensureBookingExists(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: {
        id: bookingId,
      },
      select: {
        id: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
  }

  private async ensureVehicleAssignable(vehicleId?: string) {
    if (!vehicleId) {
      return;
    }

    const vehicle = await this.prisma.vehicle.findUnique({
      where: {
        id: vehicleId,
      },
      select: {
        id: true,
        isActive: true,
      },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }

    if (!vehicle.isActive) {
      throw new BadRequestException('Inactive vehicles cannot be assigned');
    }
  }

  private async ensureDriverAssignable(driverId?: string) {
    if (!driverId) {
      return;
    }

    const driver = await this.prisma.driver.findUnique({
      where: {
        id: driverId,
      },
      select: {
        id: true,
        isActive: true,
      },
    });

    if (!driver) {
      throw new NotFoundException('Driver not found');
    }

    if (!driver.isActive) {
      throw new BadRequestException('Inactive drivers cannot be assigned');
    }
  }

  private async toUpdateData(
    siteVisitDto: UpdateSiteVisitDto,
    user: AuthenticatedUser,
  ): Promise<Prisma.SiteVisitUncheckedUpdateInput> {
    const data: Prisma.SiteVisitUncheckedUpdateInput = {};

    if (siteVisitDto.scheduledAt !== undefined) {
      data.scheduledAt = new Date(siteVisitDto.scheduledAt);
    }

    if (siteVisitDto.notes !== undefined) {
      data.notes = this.cleanText(siteVisitDto.notes) ?? null;
    }

    if (siteVisitDto.outcomeNotes !== undefined) {
      data.outcomeNotes = this.cleanText(siteVisitDto.outcomeNotes) ?? null;
    }

    if (siteVisitDto.leadId !== undefined) {
      data.leadId = siteVisitDto.leadId;
    }

    if (siteVisitDto.customerId !== undefined) {
      data.customerId = siteVisitDto.customerId;
    }

    if (siteVisitDto.projectId !== undefined) {
      data.projectId = siteVisitDto.projectId;
    }

    if (siteVisitDto.bookingId !== undefined) {
      data.bookingId = siteVisitDto.bookingId;
    }

    if (siteVisitDto.vehicleId !== undefined) {
      data.vehicleId = siteVisitDto.vehicleId;
    }

    if (siteVisitDto.driverId !== undefined) {
      data.driverId = siteVisitDto.driverId;
    }

    if (siteVisitDto.assignedToId !== undefined) {
      throwForbiddenUnless(
        user.role === UserRole.ADMIN,
        'You are not allowed to assign site visits',
      );

      data.assignedToId = await this.resolveAssignedToId(
        siteVisitDto.assignedToId,
      );
    }

    return data;
  }

  private async resolveAssignedToId(assignedToId?: string) {
    if (!assignedToId) {
      return undefined;
    }

    const assignedUser = await this.prisma.user.findUnique({
      where: {
        id: assignedToId,
      },
    });

    if (!assignedUser) {
      throw new NotFoundException('Assigned user not found');
    }

    if (
      assignedUser.role !== UserRole.SALES_EXECUTIVE &&
      assignedUser.role !== UserRole.SITE_VISIT_COORDINATOR
    ) {
      throw new BadRequestException(
        'Site visits can only be assigned to sales or SVC users',
      );
    }

    return assignedUser.id;
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

  private toSiteVisitMetadata(
    siteVisit: {
      id: string;
      leadId: string | null;
      customerId: string | null;
      projectId: string | null;
      bookingId: string | null;
      assignedToId: string | null;
      vehicleId: string | null;
      driverId: string | null;
      scheduledAt: Date;
      status: SiteVisitStatus;
    },
    extra: Prisma.InputJsonObject = {},
  ): Prisma.InputJsonObject {
    return {
      siteVisitId: siteVisit.id,
      leadId: siteVisit.leadId,
      customerId: siteVisit.customerId,
      projectId: siteVisit.projectId,
      bookingId: siteVisit.bookingId,
      assignedToId: siteVisit.assignedToId,
      vehicleId: siteVisit.vehicleId,
      driverId: siteVisit.driverId,
      scheduledAt: siteVisit.scheduledAt.toISOString(),
      status: siteVisit.status,
      ...extra,
    };
  }

  private toLifecycleMetadataExtra(
    siteVisit: {
      cancellationReason: string | null;
      outcomeNotes: string | null;
    },
    activityAction: string,
  ): Prisma.InputJsonObject {
    if (activityAction === 'site_visit.cancelled') {
      return {
        cancellationReason: siteVisit.cancellationReason,
      };
    }

    if (activityAction === 'site_visit.completed') {
      return {
        outcomeNotes: siteVisit.outcomeNotes,
      };
    }

    return {};
  }
}
