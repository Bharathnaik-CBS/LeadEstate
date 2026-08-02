import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivityEventsService } from '../activity-events/activity-events.service';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { throwForbiddenUnless } from '../auth/policies';
import { FollowUpStatus, Prisma, UserRole } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFollowUpDto } from './dto/create-follow-up.dto';
import { UpdateFollowUpDto } from './dto/update-follow-up.dto';

const followUpInclude = {
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
};

@Injectable()
export class FollowUpsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityEventsService: ActivityEventsService,
  ) {}

  async create(createFollowUpDto: CreateFollowUpDto, user: AuthenticatedUser) {
    this.ensureFollowUpTarget(createFollowUpDto);

    const assignedToId = await this.resolveAssignedToId(
      user.role === UserRole.SALES_EXECUTIVE
        ? user.userId
        : createFollowUpDto.assignedToId,
    );
    const status = createFollowUpDto.status ?? FollowUpStatus.PENDING;

    const followUp = await this.prisma.followUp.create({
      data: {
        dueAt: new Date(createFollowUpDto.dueAt),
        status,
        notes: this.cleanText(createFollowUpDto.notes),
        completedAt: this.toCompletedAt(status, createFollowUpDto.completedAt),
        leadId: createFollowUpDto.leadId,
        customerId: createFollowUpDto.customerId,
        assignedToId,
        createdById: user.userId,
      },
      include: followUpInclude,
    });

    await this.activityEventsService.log({
      action: 'follow_up.created',
      targetType: 'FollowUp',
      targetId: followUp.id,
      actorId: user.userId,
      metadata: this.toFollowUpMetadata(followUp),
    });

    return followUp;
  }

  findAll(user: AuthenticatedUser) {
    return this.prisma.followUp.findMany({
      where: this.getFollowUpVisibilityWhere(user),
      orderBy: {
        dueAt: 'asc',
      },
      include: followUpInclude,
    });
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const followUp = await this.prisma.followUp.findUnique({
      where: { id },
      include: followUpInclude,
    });

    if (!followUp) {
      throw new NotFoundException('Follow-up not found');
    }

    throwForbiddenUnless(
      this.canManageFollowUp(user, followUp),
      'You are not allowed to view this follow-up',
    );

    return followUp;
  }

  async update(
    id: string,
    updateFollowUpDto: UpdateFollowUpDto,
    user: AuthenticatedUser,
  ) {
    const followUp = await this.ensureFollowUpExists(id);

    throwForbiddenUnless(
      this.canManageFollowUp(user, followUp),
      'You are not allowed to update this follow-up',
    );

    const data = await this.toUpdateFollowUpData(updateFollowUpDto, user);

    const updatedFollowUp = await this.prisma.followUp.update({
      where: { id },
      data,
      include: followUpInclude,
    });

    await this.activityEventsService.log({
      action: this.getFollowUpUpdateAction(followUp, updatedFollowUp),
      targetType: 'FollowUp',
      targetId: updatedFollowUp.id,
      actorId: user.userId,
      metadata: this.toFollowUpMetadata(
        updatedFollowUp,
        this.toFollowUpChangeMetadata(followUp, updatedFollowUp),
      ),
    });

    return updatedFollowUp;
  }

  private getFollowUpVisibilityWhere(
    user: AuthenticatedUser,
  ): Prisma.FollowUpWhereInput {
    if (user.role === UserRole.ADMIN) {
      return {};
    }

    return {
      OR: [{ assignedToId: user.userId }, { createdById: user.userId }],
    };
  }

  private async ensureFollowUpExists(id: string) {
    const followUp = await this.prisma.followUp.findUnique({
      where: { id },
    });

    if (!followUp) {
      throw new NotFoundException('Follow-up not found');
    }

    return followUp;
  }

  private async toUpdateFollowUpData(
    followUpDto: UpdateFollowUpDto,
    user: AuthenticatedUser,
  ): Promise<Prisma.FollowUpUncheckedUpdateInput> {
    const data: Prisma.FollowUpUncheckedUpdateInput = {};

    if (followUpDto.dueAt !== undefined) {
      data.dueAt = new Date(followUpDto.dueAt);
    }

    if (followUpDto.status !== undefined) {
      data.status = followUpDto.status;
    }

    if (followUpDto.notes !== undefined) {
      data.notes = this.cleanText(followUpDto.notes) ?? null;
    }

    if (followUpDto.completedAt !== undefined) {
      data.completedAt = new Date(followUpDto.completedAt);
    } else if (followUpDto.status === FollowUpStatus.COMPLETED) {
      data.completedAt = new Date();
    }

    if (followUpDto.leadId !== undefined) {
      data.leadId = followUpDto.leadId;
    }

    if (followUpDto.customerId !== undefined) {
      data.customerId = followUpDto.customerId;
    }

    if (followUpDto.assignedToId !== undefined) {
      throwForbiddenUnless(
        user.role === UserRole.ADMIN,
        'You are not allowed to assign follow-ups',
      );

      data.assignedToId = await this.resolveAssignedToId(
        followUpDto.assignedToId,
      );
    }

    return data;
  }

  private canManageFollowUp(
    user: AuthenticatedUser,
    followUp: { assignedToId: string | null; createdById: string | null },
  ) {
    if (user.role === UserRole.ADMIN) {
      return true;
    }

    return (
      followUp.assignedToId === user.userId || followUp.createdById === user.userId
    );
  }

  private ensureFollowUpTarget(followUpDto: CreateFollowUpDto) {
    if (followUpDto.leadId || followUpDto.customerId) {
      return;
    }

    throw new BadRequestException(
      'Follow-up must be linked to a lead or customer',
    );
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
      throw new BadRequestException(
        'Follow-ups can only be assigned to sales users',
      );
    }

    return assignedUser.id;
  }

  private toCompletedAt(status: FollowUpStatus, completedAt?: string) {
    if (completedAt) {
      return new Date(completedAt);
    }

    if (status === FollowUpStatus.COMPLETED) {
      return new Date();
    }

    return undefined;
  }

  private cleanText(value?: string) {
    const trimmedValue = value?.trim();
    return trimmedValue || undefined;
  }

  private getFollowUpUpdateAction(
    previousFollowUp: { status: FollowUpStatus },
    updatedFollowUp: { status: FollowUpStatus },
  ) {
    if (previousFollowUp.status === updatedFollowUp.status) {
      return 'follow_up.updated';
    }

    if (updatedFollowUp.status === FollowUpStatus.COMPLETED) {
      return 'follow_up.completed';
    }

    if (updatedFollowUp.status === FollowUpStatus.CANCELLED) {
      return 'follow_up.cancelled';
    }

    return 'follow_up.updated';
  }

  private toFollowUpMetadata(
    followUp: {
      id: string;
      leadId: string | null;
      customerId: string | null;
      assignedToId: string | null;
      status: FollowUpStatus;
      dueAt: Date;
      completedAt: Date | null;
    },
    extra: Prisma.InputJsonObject = {},
  ): Prisma.InputJsonObject {
    return {
      followUpId: followUp.id,
      leadId: followUp.leadId,
      customerId: followUp.customerId,
      assignedToId: followUp.assignedToId,
      status: followUp.status,
      dueAt: followUp.dueAt.toISOString(),
      completedAt: this.toJsonDate(followUp.completedAt),
      ...extra,
    };
  }

  private toFollowUpChangeMetadata(
    previousFollowUp: {
      status: FollowUpStatus;
      assignedToId: string | null;
    },
    updatedFollowUp: {
      status: FollowUpStatus;
      assignedToId: string | null;
    },
  ): Prisma.InputJsonObject {
    return {
      ...(previousFollowUp.status !== updatedFollowUp.status
        ? { previousStatus: previousFollowUp.status }
        : {}),
      ...(previousFollowUp.assignedToId !== updatedFollowUp.assignedToId
        ? { previousAssignedToId: previousFollowUp.assignedToId }
        : {}),
    };
  }

  private toJsonDate(value: Date | null) {
    return value ? value.toISOString() : null;
  }
}
