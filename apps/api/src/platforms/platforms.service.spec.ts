import type { PrismaService } from '../prisma/prisma.service';
import { PlatformsService } from './platforms.service';

describe('PlatformsService', () => {
  let prisma: {
    platform: {
      create: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
  };
  let service: PlatformsService;

  beforeEach(() => {
    prisma = {
      platform: {
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };
    service = new PlatformsService(prisma as unknown as PrismaService);
  });

  it('creates a platform with a trimmed name', async () => {
    const platform = createPlatform();
    prisma.platform.create.mockResolvedValue(platform);

    await expect(service.create({ name: ' Website ' })).resolves.toEqual(
      platform,
    );
    expect(prisma.platform.create).toHaveBeenCalledWith({
      data: {
        name: 'Website',
      },
    });
  });

  it('lists platforms ordered by name', async () => {
    const platforms = [createPlatform()];
    prisma.platform.findMany.mockResolvedValue(platforms);

    await expect(service.findAll()).resolves.toEqual(platforms);
    expect(prisma.platform.findMany).toHaveBeenCalledWith({
      orderBy: {
        name: 'asc',
      },
    });
  });

  it('updates a platform name', async () => {
    const platform = createPlatform({ name: 'Referral' });
    prisma.platform.update.mockResolvedValue(platform);

    await expect(
      service.update(platform.id, { name: ' Referral ' }),
    ).resolves.toEqual(platform);
    expect(prisma.platform.update).toHaveBeenCalledWith({
      where: {
        id: platform.id,
      },
      data: {
        name: 'Referral',
      },
    });
  });

  function createPlatform(overrides = {}) {
    return {
      id: 'platform-1',
      name: 'Website',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      ...overrides,
    };
  }
});
