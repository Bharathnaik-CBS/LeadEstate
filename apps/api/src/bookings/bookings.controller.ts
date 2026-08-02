import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { PERMISSIONS } from '../auth/permissions';
import { BookingsService } from './bookings.service';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { CloseSaleDto } from './dto/close-sale.dto';
import { CreateBookingPaymentDto } from './dto/create-booking-payment.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingKycDto } from './dto/update-booking-kyc.dto';

@Controller('bookings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @Permissions(PERMISSIONS.BOOKINGS.CREATE)
  create(
    @Body() createBookingDto: CreateBookingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bookingsService.create(createBookingDto, user);
  }

  @Get('recent')
  @Permissions(PERMISSIONS.BOOKINGS.VIEW_RECENT)
  findRecent(@CurrentUser() user: AuthenticatedUser) {
    return this.bookingsService.findRecent(user);
  }

  @Patch(':bookingId/cancel')
  @Permissions(PERMISSIONS.BOOKINGS.CANCEL)
  cancelBooking(
    @Param('bookingId') bookingId: string,
    @Body() cancelBookingDto: CancelBookingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bookingsService.cancelBooking(
      bookingId,
      user,
      cancelBookingDto,
    );
  }

  @Patch(':bookingId/close-sale')
  @Permissions(PERMISSIONS.BOOKINGS.CLOSE_SALE)
  closeSale(
    @Param('bookingId') bookingId: string,
    @Body() closeSaleDto: CloseSaleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bookingsService.closeSale(bookingId, user, closeSaleDto);
  }

  @Post(':bookingId/payments')
  @Permissions(PERMISSIONS.PAYMENTS.CREATE)
  createPayment(
    @Param('bookingId') bookingId: string,
    @Body() createPaymentDto: CreateBookingPaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bookingsService.createPayment(
      bookingId,
      createPaymentDto,
      user,
    );
  }

  @Get(':bookingId/payments')
  @Permissions(PERMISSIONS.PAYMENTS.VIEW)
  findPayments(
    @Param('bookingId') bookingId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bookingsService.findPayments(bookingId, user);
  }

  @Get(':bookingId/kyc')
  @Permissions(PERMISSIONS.KYC.VIEW)
  getKyc(
    @Param('bookingId') bookingId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bookingsService.getKyc(bookingId, user);
  }

  @Patch(':bookingId/kyc')
  @Permissions(PERMISSIONS.KYC.UPDATE)
  updateKyc(
    @Param('bookingId') bookingId: string,
    @Body() updateKycDto: UpdateBookingKycDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bookingsService.updateKyc(bookingId, updateKycDto, user);
  }
}
