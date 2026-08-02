import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateSalesExecutiveDto } from './create-sales-executive.dto';

describe('CreateSalesExecutiveDto', () => {
  it('trims SE ID and accepts a strong temporary password', async () => {
    const dto = plainToInstance(CreateSalesExecutiveDto, {
      seId: ' SE-001 ',
      email: 'sales@example.com',
      password: 'StrongPass123!',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.seId).toBe('SE-001');
  });

  it('rejects invalid SE IDs and weak temporary passwords', async () => {
    const dto = plainToInstance(CreateSalesExecutiveDto, {
      seId: 'bad id!',
      email: 'sales@example.com',
      password: 'weakpassword',
    });

    const errors = await validate(dto);
    const failedProperties = errors.map((error) => error.property);

    expect(failedProperties).toContain('seId');
    expect(failedProperties).toContain('password');
  });
});
