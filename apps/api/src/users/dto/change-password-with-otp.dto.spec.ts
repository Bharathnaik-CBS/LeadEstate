import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ChangePasswordWithOtpDto } from './change-password-with-otp.dto';

describe('ChangePasswordWithOtpDto', () => {
  it('accepts a numeric OTP and strong new password', async () => {
    const dto = plainToInstance(ChangePasswordWithOtpDto, {
      otp: '123456',
      newPassword: 'NewStrong123!',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects non-numeric OTPs and weak new passwords', async () => {
    const dto = plainToInstance(ChangePasswordWithOtpDto, {
      otp: '12ab56',
      newPassword: 'weakpassword',
    });

    const errors = await validate(dto);
    const failedProperties = errors.map((error) => error.property);

    expect(failedProperties).toContain('otp');
    expect(failedProperties).toContain('newPassword');
  });
});
