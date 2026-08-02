import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivityEventsService } from '../activity-events/activity-events.service';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import {
  canAssignLead,
  canDeleteLead,
  canUpdateAssignedLead,
  canUpdateLead,
  canViewAssignedLeads,
  canViewLead,
  throwForbiddenUnless,
} from '../auth/policies';
import {
  LeadSource,
  LeadStatus,
  Prisma,
  UserRole,
  type Lead,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AssignLeadDto } from './dto/assign-lead.dto';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadStatusDto } from './dto/update-lead-status.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';

const leadInclude = {
  createdBy: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
  assignedTo: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
  finalProject: {
    select: {
      id: true,
      projectName: true,
      location: true,
    },
  },
  finalPlot: {
    select: {
      id: true,
      plotNumber: true,
      size: true,
      facing: true,
      price: true,
      status: true,
    },
  },
  platform: {
    select: {
      id: true,
      name: true,
    },
  },
  bookings: {
    orderBy: {
      bookingDate: 'desc' as const,
    },
    take: 1,
    include: {
      project: {
        select: {
          id: true,
          projectName: true,
          location: true,
        },
      },
      plot: {
        select: {
          id: true,
          plotNumber: true,
          status: true,
        },
      },
      salesExecutive: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  },
};

type CreateLeadOptions = {
  createdById: string;
  assignedToId?: string;
  defaultSource: LeadSource;
  defaultStatus?: LeadStatus;
  forceSource?: boolean;
  forceStatus?: boolean;
};

type InterestedProjectWriter = Pick<
  Prisma.TransactionClient,
  'leadInterestedProject' | 'project'
>;

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityEventsService: ActivityEventsService,
  ) {}

  async create(createLeadDto: CreateLeadDto, user: AuthenticatedUser) {
    if (user.role === UserRole.SALES_EXECUTIVE) {
      return this.createSalesLead(createLeadDto, user.userId);
    }

    const assignedToId = await this.resolveAssignedToId(
      createLeadDto.assignedToId,
    );

    const lead = await this.prisma.lead.create({
      data: this.toCreateLeadData(createLeadDto, {
        createdById: user.userId,
        assignedToId,
        defaultSource: LeadSource.ADMIN_GENERATED,
        defaultStatus: LeadStatus.NEW,
      }),
      include: leadInclude,
    });

    await this.activityEventsService.log({
      action: 'lead.created',
      targetType: 'Lead',
      targetId: lead.id,
      actorId: user.userId,
      metadata: this.toLeadMetadata(lead),
    });

    return lead;
  }

  private async createSalesLead(createLeadDto: CreateLeadDto, userId: string) {
    const lead = await this.prisma.lead.create({
      data: this.toCreateLeadData(createLeadDto, {
        createdById: userId,
        assignedToId: userId,
        defaultSource: LeadSource.SE_GENERATED,
        defaultStatus: LeadStatus.NEW,
        forceSource: true,
        forceStatus: true,
      }),
      include: leadInclude,
    });

    await this.activityEventsService.log({
      action: 'lead.created',
      targetType: 'Lead',
      targetId: lead.id,
      actorId: userId,
      metadata: this.toLeadMetadata(lead),
    });

    return lead;
  }

  findAll() {
    return this.prisma.lead.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      include: leadInclude,
    });
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      include: leadInclude,
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    throwForbiddenUnless(
      canViewLead(user, lead),
      'You are not allowed to view this lead',
    );

    return lead;
  }

  async findAssignedToUser(user: AuthenticatedUser) {
    throwForbiddenUnless(
      canViewAssignedLeads(user),
      'You are not allowed to view assigned leads',
    );

    return this.prisma.lead.findMany({
      where: {
        assignedToId: user.userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: leadInclude,
    });
  }

  async update(
    id: string,
    updateLeadDto: UpdateLeadDto,
    user: AuthenticatedUser,
  ) {
    const lead = await this.ensureLeadExists(id);
    throwForbiddenUnless(
      canUpdateLead(user, lead),
      'You are not allowed to update this lead',
    );

    const interestedProjectIds = this.getInterestedProjectIds(
      updateLeadDto.interestedProjectIds,
    );
    const data = this.toUpdateLeadData(updateLeadDto, interestedProjectIds);

    if (interestedProjectIds === undefined) {
      const updatedLead = await this.prisma.lead.update({
        where: { id },
        data,
        include: leadInclude,
      });

      await this.activityEventsService.log({
        action: 'lead.updated',
        targetType: 'Lead',
        targetId: updatedLead.id,
        actorId: user.userId,
        metadata: this.toLeadMetadata(
          updatedLead,
          this.toLeadChangeMetadata(lead, updatedLead),
        ),
      });

      return updatedLead;
    }

    return this.prisma.$transaction(async (tx) => {
      await this.ensureInterestedProjectsExist(tx, interestedProjectIds);
      await this.syncInterestedProjects(tx, id, interestedProjectIds);

      const updatedLead = await tx.lead.update({
        where: { id },
        data,
        include: leadInclude,
      });

      await this.activityEventsService.log(
        {
          action: 'lead.updated',
          targetType: 'Lead',
          targetId: updatedLead.id,
          actorId: user.userId,
          metadata: this.toLeadMetadata(
            updatedLead,
            this.toLeadChangeMetadata(lead, updatedLead),
          ),
        },
        tx,
      );

      return updatedLead;
    });
  }

  async remove(id: string, user: AuthenticatedUser) {
    const lead = await this.ensureLeadExists(id);
    throwForbiddenUnless(
      canDeleteLead(user, lead),
      'You are not allowed to delete this lead',
    );

    await this.prisma.lead.delete({
      where: { id },
    });

    await this.activityEventsService.log({
      action: 'lead.deleted',
      targetType: 'Lead',
      targetId: lead.id,
      actorId: user.userId,
      metadata: this.toLeadMetadata(lead),
    });

    return {
      message: 'Lead deleted',
    };
  }

  async assign(
    id: string,
    assignLeadDto: AssignLeadDto,
    user: AuthenticatedUser,
  ) {
    throwForbiddenUnless(
      canAssignLead(user),
      'You are not allowed to assign leads',
    );

    const lead = await this.ensureLeadExists(id);
    const assignedToId = await this.resolveAssignedToId(
      assignLeadDto.assignedToId,
    );

    const updatedLead = await this.prisma.lead.update({
      where: { id },
      data: {
        assignedTo: {
          connect: {
            id: assignedToId,
          },
        },
      },
      include: leadInclude,
    });

    await this.activityEventsService.log({
      action: 'lead.assigned',
      targetType: 'Lead',
      targetId: updatedLead.id,
      actorId: user.userId,
      metadata: this.toLeadMetadata(updatedLead, {
        previousAssignedToId: lead.assignedToId,
      }),
    });

    return updatedLead;
  }

  async updateAssignedLeadStatus(
    id: string,
    user: AuthenticatedUser,
    updateLeadStatusDto: UpdateLeadStatusDto,
  ) {
    const lead = await this.ensureLeadExists(id);
    throwForbiddenUnless(
      canUpdateAssignedLead(user, lead),
      'You are not allowed to update this lead',
    );

    const interestedProjectIds = this.getInterestedProjectIds(
      updateLeadStatusDto.interestedProjectIds,
    );
    const data = this.toSalesLeadProgressData(
      updateLeadStatusDto,
      interestedProjectIds,
    );

    if (interestedProjectIds === undefined) {
      const updatedLead = await this.prisma.lead.update({
        where: { id },
        data,
        include: leadInclude,
      });

      await this.activityEventsService.log({
        action: 'lead.updated',
        targetType: 'Lead',
        targetId: updatedLead.id,
        actorId: user.userId,
        metadata: this.toLeadMetadata(
          updatedLead,
          this.toLeadChangeMetadata(lead, updatedLead),
        ),
      });

      return updatedLead;
    }

    return this.prisma.$transaction(async (tx) => {
      await this.ensureInterestedProjectsExist(tx, interestedProjectIds);
      await this.syncInterestedProjects(tx, id, interestedProjectIds);

      const updatedLead = await tx.lead.update({
        where: { id },
        data,
        include: leadInclude,
      });

      await this.activityEventsService.log(
        {
          action: 'lead.updated',
          targetType: 'Lead',
          targetId: updatedLead.id,
          actorId: user.userId,
          metadata: this.toLeadMetadata(
            updatedLead,
            this.toLeadChangeMetadata(lead, updatedLead),
          ),
        },
        tx,
      );

      return updatedLead;
    });
  }

  async getDashboardSummary(user: AuthenticatedUser) {
    const where = this.getLeadVisibilityWhere(user);
    const [total, statusCounts] = await Promise.all([
      this.prisma.lead.count({ where }),
      this.prisma.lead.groupBy({
        by: ['status'],
        where,
        _count: {
          _all: true,
        },
      }),
    ]);

    const byStatus = Object.values(LeadStatus).reduce(
      (summary, status) => ({
        ...summary,
        [status]: 0,
      }),
      {} as Record<LeadStatus, number>,
    );

    for (const item of statusCounts) {
      byStatus[item.status] = item._count._all;
    }

    return {
      total,
      byStatus,
    };
  }

  private getLeadVisibilityWhere(
    user: AuthenticatedUser,
  ): Prisma.LeadWhereInput {
    if (user.role === UserRole.ADMIN) {
      return {};
    }

    return {
      assignedToId: user.userId,
    };
  }

  private async ensureLeadExists(id: string): Promise<Lead> {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    return lead;
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

    if (assignedUser.role !== UserRole.SALES_EXECUTIVE) {
      throw new BadRequestException('Leads can only be assigned to sales users');
    }

    return assignedUser.id;
  }

  private toCreateLeadData(
    leadDto: CreateLeadDto,
    options: CreateLeadOptions,
  ): Prisma.LeadCreateInput {
    const source = options.forceSource
      ? options.defaultSource
      : leadDto.source ?? options.defaultSource;
    const status = options.forceStatus
      ? options.defaultStatus
      : leadDto.status ?? options.defaultStatus;

    return {
      fullName: leadDto.fullName.trim(),
      phone: leadDto.phone.trim(),
      email: this.cleanText(leadDto.email)?.toLowerCase(),
      propertyType: this.cleanText(leadDto.propertyType),
      budget: this.cleanText(leadDto.budget),
      location: this.cleanText(leadDto.location),
      source,
      status,
      notes: this.cleanText(leadDto.notes),
      remarks: this.cleanText(leadDto.remarks),
      followUpDate: this.toDate(leadDto.followUpDate),
      platform: leadDto.platformId
        ? {
            connect: {
              id: leadDto.platformId,
            },
          }
        : undefined,
      createdBy: {
        connect: {
          id: options.createdById,
        },
      },
      assignedTo: options.assignedToId
        ? {
            connect: {
              id: options.assignedToId,
            },
          }
        : undefined,
    };
  }

  private toUpdateLeadData(
    leadDto: UpdateLeadDto,
    interestedProjectIds?: string[],
  ): Prisma.LeadUpdateInput {
    const data: Prisma.LeadUpdateInput = {};

    if (leadDto.fullName !== undefined) {
      data.fullName = leadDto.fullName.trim();
    }

    if (leadDto.phone !== undefined) {
      data.phone = leadDto.phone.trim();
    }

    if (leadDto.email !== undefined) {
      data.email = this.cleanText(leadDto.email)?.toLowerCase() ?? null;
    }

    if (leadDto.propertyType !== undefined) {
      data.propertyType = this.cleanText(leadDto.propertyType) ?? null;
    }

    if (leadDto.budget !== undefined) {
      data.budget = this.cleanText(leadDto.budget) ?? null;
    }

    if (leadDto.location !== undefined) {
      data.location = this.cleanText(leadDto.location) ?? null;
    }

    if (leadDto.source !== undefined) {
      data.source = leadDto.source;
    }

    if (leadDto.platformId !== undefined) {
      data.platform = {
        connect: {
          id: leadDto.platformId,
        },
      };
    }

    if (leadDto.status !== undefined) {
      data.status = leadDto.status;
    }

    if (leadDto.notes !== undefined) {
      data.notes = this.cleanText(leadDto.notes) ?? null;
    }

    if (leadDto.remarks !== undefined) {
      data.remarks = this.cleanText(leadDto.remarks) ?? null;
    }

    if (leadDto.followUpDate !== undefined) {
      data.followUpDate = this.toDate(leadDto.followUpDate);
    }

    if (leadDto.interestedProjectIds !== undefined) {
      data.interestedProjectIds = {
        set:
          interestedProjectIds ??
          this.cleanProjectIds(leadDto.interestedProjectIds),
      };
    }

    return data;
  }

  private toSalesLeadProgressData(
    leadDto: UpdateLeadStatusDto,
    interestedProjectIds?: string[],
  ): Prisma.LeadUpdateInput {
    const data: Prisma.LeadUpdateInput = {};

    if (leadDto.status !== undefined) {
      data.status = leadDto.status;
    }

    if (leadDto.followUpDate !== undefined) {
      data.followUpDate = this.toDate(leadDto.followUpDate);
    }

    if (leadDto.remarks !== undefined) {
      data.remarks = this.cleanText(leadDto.remarks) ?? null;
    }

    if (leadDto.interestedProjectIds !== undefined) {
      data.interestedProjectIds = {
        set:
          interestedProjectIds ??
          this.cleanProjectIds(leadDto.interestedProjectIds),
      };
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('At least one lead update field is required');
    }

    return data;
  }

  private cleanText(value?: string) {
    const trimmedValue = value?.trim();
    return trimmedValue || undefined;
  }

  private toLeadMetadata(
    lead: {
      id: string;
      assignedToId: string | null;
      status: LeadStatus;
    },
    extra: Prisma.InputJsonObject = {},
  ): Prisma.InputJsonObject {
    return {
      leadId: lead.id,
      assignedToId: lead.assignedToId,
      status: lead.status,
      ...extra,
    };
  }

  private toLeadChangeMetadata(
    previousLead: {
      status: LeadStatus;
      assignedToId: string | null;
    },
    updatedLead: {
      status: LeadStatus;
      assignedToId: string | null;
    },
  ): Prisma.InputJsonObject {
    return {
      ...(previousLead.status !== updatedLead.status
        ? { previousStatus: previousLead.status }
        : {}),
      ...(previousLead.assignedToId !== updatedLead.assignedToId
        ? { previousAssignedToId: previousLead.assignedToId }
        : {}),
    };
  }

  private toDate(value?: string) {
    return value ? new Date(value) : undefined;
  }

  private getInterestedProjectIds(projectIds?: string[]) {
    if (projectIds === undefined) {
      return undefined;
    }

    return this.cleanProjectIds(projectIds);
  }

  private async ensureInterestedProjectsExist(
    prisma: InterestedProjectWriter,
    projectIds: string[],
  ) {
    if (projectIds.length === 0) {
      return;
    }

    const existingProjects = await prisma.project.count({
      where: {
        id: {
          in: projectIds,
        },
      },
    });

    if (existingProjects !== projectIds.length) {
      throw new BadRequestException(
        'One or more interested projects do not exist',
      );
    }
  }

  private async syncInterestedProjects(
    prisma: InterestedProjectWriter,
    leadId: string,
    projectIds: string[],
  ) {
    await prisma.leadInterestedProject.deleteMany({
      where: {
        leadId,
      },
    });

    if (projectIds.length === 0) {
      return;
    }

    await prisma.leadInterestedProject.createMany({
      data: projectIds.map((projectId) => ({
        leadId,
        projectId,
      })),
      skipDuplicates: true,
    });
  }

  private cleanProjectIds(projectIds: string[]) {
    const cleanedProjectIds = Array.from(
      new Set(
        projectIds
          .map((projectId) => projectId.trim())
          .filter((projectId) => projectId.length > 0),
      ),
    );

    const hasMalformedId = cleanedProjectIds.some(
      (projectId) => !uuidPattern.test(projectId),
    );

    if (hasMalformedId) {
      throw new BadRequestException(
        'Interested project IDs must be valid UUIDs',
      );
    }

    return cleanedProjectIds;
  }
}
