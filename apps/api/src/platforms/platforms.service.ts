import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlatformDto } from './dto/create-platform.dto';
import { UpdatePlatformDto } from './dto/update-platform.dto';

@Injectable()
export class PlatformsService {
  constructor(private readonly prisma: PrismaService) {}

  create(createPlatformDto: CreatePlatformDto) {
    return this.prisma.platform.create({
      data: {
        name: createPlatformDto.name.trim(),
      },
    });
  }

  findAll() {
    return this.prisma.platform.findMany({
      orderBy: {
        name: 'asc',
      },
    });
  }

  update(id: string, updatePlatformDto: UpdatePlatformDto) {
    return this.prisma.platform.update({
      where: {
        id,
      },
      data:
        updatePlatformDto.name === undefined
          ? {}
          : {
              name: updatePlatformDto.name.trim(),
            },
    });
  }
}
