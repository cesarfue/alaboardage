import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSearchDto } from './dto/create-search.dto';

@Injectable()
export class SearchesService {
  constructor(private readonly prisma: PrismaService) {}

  getSavedSearches(userId: string) {
    return this.prisma.savedSearch.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  createSavedSearch(userId: string, dto: CreateSearchDto) {
    return this.prisma.savedSearch.create({
      data: {
        userId,
        name: dto.name,
        query: dto.query,
        location: dto.location,
      },
    });
  }

  async deleteSavedSearch(userId: string, id: string) {
    const result = await this.prisma.savedSearch.deleteMany({
      where: { id, userId },
    });
    if (result.count === 0) {
      throw new NotFoundException('Saved search not found');
    }
  }
}
