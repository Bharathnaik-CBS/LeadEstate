import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { PERMISSIONS } from '../auth/permissions';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomersService } from './customers.service';

@Controller('customers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @Permissions(PERMISSIONS.CUSTOMERS.CREATE)
  create(
    @Body() createCustomerDto: CreateCustomerDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.customersService.create(createCustomerDto, user);
  }

  @Get()
  @Permissions(PERMISSIONS.CUSTOMERS.VIEW_ASSIGNED)
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.customersService.findAll(user);
  }

  @Get(':id')
  @Permissions(PERMISSIONS.CUSTOMERS.VIEW_ASSIGNED)
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.customersService.findOne(id, user);
  }

  @Patch(':id')
  @Permissions(PERMISSIONS.CUSTOMERS.UPDATE_ASSIGNED)
  update(
    @Param('id') id: string,
    @Body() updateCustomerDto: UpdateCustomerDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.customersService.update(id, updateCustomerDto, user);
  }
}
