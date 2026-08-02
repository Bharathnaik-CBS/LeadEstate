import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivityEventsService } from '../activity-events/activity-events.service';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { throwForbiddenUnless } from '../auth/policies';
import {
  CustomerJourneyStatus,
  Prisma,
  UserRole,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

const customerInclude = {
  sourceLead: {
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
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityEventsService: ActivityEventsService,
  ) {}

  async create(createCustomerDto: CreateCustomerDto, user: AuthenticatedUser) {
    const assignedToId = await this.resolveAssignedToId(
      user.role === UserRole.SALES_EXECUTIVE
        ? user.userId
        : createCustomerDto.assignedToId,
    );

    const customer = await this.prisma.customer.create({
      data: {
        fullName: createCustomerDto.fullName.trim(),
        phone: createCustomerDto.phone.trim(),
        email: this.cleanText(createCustomerDto.email)?.toLowerCase(),
        status: createCustomerDto.status,
        notes: this.cleanText(createCustomerDto.notes),
        sourceLeadId: createCustomerDto.sourceLeadId,
        assignedToId,
        createdById: user.userId,
      },
      include: customerInclude,
    });

    await this.activityEventsService.log({
      action: 'customer.created',
      targetType: 'Customer',
      targetId: customer.id,
      actorId: user.userId,
      metadata: this.toCustomerMetadata(customer),
    });

    return customer;
  }

  findAll(user: AuthenticatedUser) {
    return this.prisma.customer.findMany({
      where: this.getCustomerVisibilityWhere(user),
      orderBy: {
        createdAt: 'desc',
      },
      include: customerInclude,
    });
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: customerInclude,
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    throwForbiddenUnless(
      this.canManageCustomer(user, customer),
      'You are not allowed to view this customer',
    );

    return customer;
  }

  async update(
    id: string,
    updateCustomerDto: UpdateCustomerDto,
    user: AuthenticatedUser,
  ) {
    const customer = await this.ensureCustomerExists(id);

    throwForbiddenUnless(
      this.canManageCustomer(user, customer),
      'You are not allowed to update this customer',
    );

    const data = await this.toUpdateCustomerData(updateCustomerDto, user);

    const updatedCustomer = await this.prisma.customer.update({
      where: { id },
      data,
      include: customerInclude,
    });

    await this.activityEventsService.log({
      action: 'customer.updated',
      targetType: 'Customer',
      targetId: updatedCustomer.id,
      actorId: user.userId,
      metadata: this.toCustomerMetadata(
        updatedCustomer,
        this.toCustomerChangeMetadata(customer, updatedCustomer),
      ),
    });

    return updatedCustomer;
  }

  private getCustomerVisibilityWhere(
    user: AuthenticatedUser,
  ): Prisma.CustomerWhereInput {
    if (user.role === UserRole.ADMIN) {
      return {};
    }

    return {
      OR: [{ assignedToId: user.userId }, { createdById: user.userId }],
    };
  }

  private async ensureCustomerExists(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  private async toUpdateCustomerData(
    customerDto: UpdateCustomerDto,
    user: AuthenticatedUser,
  ): Promise<Prisma.CustomerUncheckedUpdateInput> {
    const data: Prisma.CustomerUncheckedUpdateInput = {};

    if (customerDto.fullName !== undefined) {
      data.fullName = customerDto.fullName.trim();
    }

    if (customerDto.phone !== undefined) {
      data.phone = customerDto.phone.trim();
    }

    if (customerDto.email !== undefined) {
      data.email = this.cleanText(customerDto.email)?.toLowerCase() ?? null;
    }

    if (customerDto.status !== undefined) {
      data.status = customerDto.status;
    }

    if (customerDto.notes !== undefined) {
      data.notes = this.cleanText(customerDto.notes) ?? null;
    }

    if (customerDto.sourceLeadId !== undefined) {
      data.sourceLeadId = customerDto.sourceLeadId;
    }

    if (customerDto.assignedToId !== undefined) {
      throwForbiddenUnless(
        user.role === UserRole.ADMIN,
        'You are not allowed to assign customers',
      );

      data.assignedToId = await this.resolveAssignedToId(
        customerDto.assignedToId,
      );
    }

    return data;
  }

  private canManageCustomer(
    user: AuthenticatedUser,
    customer: { assignedToId: string | null; createdById: string | null },
  ) {
    if (user.role === UserRole.ADMIN) {
      return true;
    }

    return (
      customer.assignedToId === user.userId || customer.createdById === user.userId
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
        'Customers can only be assigned to sales users',
      );
    }

    return assignedUser.id;
  }

  private cleanText(value?: string) {
    const trimmedValue = value?.trim();
    return trimmedValue || undefined;
  }

  private toCustomerMetadata(
    customer: {
      id: string;
      assignedToId: string | null;
      status: CustomerJourneyStatus;
    },
    extra: Prisma.InputJsonObject = {},
  ): Prisma.InputJsonObject {
    return {
      customerId: customer.id,
      assignedToId: customer.assignedToId,
      status: customer.status,
      ...extra,
    };
  }

  private toCustomerChangeMetadata(
    previousCustomer: {
      status: CustomerJourneyStatus;
      assignedToId: string | null;
    },
    updatedCustomer: {
      status: CustomerJourneyStatus;
      assignedToId: string | null;
    },
  ): Prisma.InputJsonObject {
    return {
      ...(previousCustomer.status !== updatedCustomer.status
        ? { previousStatus: previousCustomer.status }
        : {}),
      ...(previousCustomer.assignedToId !== updatedCustomer.assignedToId
        ? { previousAssignedToId: previousCustomer.assignedToId }
        : {}),
    };
  }
}
