import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ListActivityEventsDto } from './dto/list-activity-events.dto';

const activityEventInclude = {
  actor: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
};

export type LogActivityEventInput = {
  action: string;
  targetType: string;
  targetId: string;
  actorId?: string;
  metadata?: Prisma.InputJsonValue;
};

@Injectable()
export class ActivityEventsService {
  constructor(private readonly prisma: PrismaService) {}

  log(input: LogActivityEventInput, tx?: Prisma.TransactionClient) {
    const prisma = tx ?? this.prisma;
    const data: Prisma.ActivityEventUncheckedCreateInput = {
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
    };

    if (input.actorId !== undefined) {
      data.actorId = input.actorId;
    }

    if (input.metadata !== undefined) {
      data.metadata = input.metadata;
    }

    return prisma.activityEvent.create({
      data,
    });
  }

  findAll(query: ListActivityEventsDto) {
    const take = query.take ?? 50;

    return this.prisma.activityEvent.findMany({
      where: this.toWhereInput(query),
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take,
      skip: query.cursor ? 1 : undefined,
      cursor: query.cursor
        ? {
            id: query.cursor,
          }
        : undefined,
      include: activityEventInclude,
    });
  }

  private toWhereInput(
    query: ListActivityEventsDto,
  ): Prisma.ActivityEventWhereInput {
    return {
      targetType: query.targetType,
      targetId: query.targetId,
      actorId: query.actorId,
      action: query.action,
      occurredAt:
        query.from || query.to
          ? {
              gte: query.from ? new Date(query.from) : undefined,
              lte: query.to ? new Date(query.to) : undefined,
            }
          : undefined,
    };
  }
}
