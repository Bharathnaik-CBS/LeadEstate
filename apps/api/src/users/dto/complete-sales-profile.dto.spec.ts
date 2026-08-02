import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Gender } from '../../generated/prisma/client';
import { CompleteSalesProfileDto } from './complete-sales-profile.dto';

describe('CompleteSalesProfileDto', () => {
  it('trims profile fields and normalizes username', async () => {
    const dto = plainToInstance(CompleteSalesProfileDto, {
      firstName: ' Sales ',
      lastName: ' User ',
      username: ' Sales.User ',
      phoneNumber: ' +919876543210 ',
      dob: '1995-01-01',
      gender: Gender.PREFER_NOT_TO_SAY,
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.firstName).toBe('Sales');
    expect(dto.lastName).toBe('User');
    expect(dto.username).toBe('sales.user');
    expect(dto.phoneNumber).toBe('+919876543210');
  });

  it('rejects loose username and phone formats', async () => {
    const dto = plainToInstance(CompleteSalesProfileDto, {
      firstName: 'Sales',
      lastName: 'User',
      username: 'sales user!',
      phoneNumber: '98765 abc',
      dob: '1995-01-01',
      gender: Gender.PREFER_NOT_TO_SAY,
    });

    const errors = await validate(dto);
    const failedProperties = errors.map((error) => error.property);

    expect(failedProperties).toContain('username');
    expect(failedProperties).toContain('phoneNumber');
  });
});
