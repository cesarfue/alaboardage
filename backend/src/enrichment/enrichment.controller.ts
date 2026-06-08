import { Controller, Post, Query } from '@nestjs/common';
import { EnrichmentService } from './enrichment.service';

@Controller('enrichment')
export class EnrichmentController {
  constructor(private readonly enrichmentService: EnrichmentService) {}

  @Post('backfill')
  backfill(@Query('limit') limit?: string) {
    return this.enrichmentService.backfill(limit ? parseInt(limit) : undefined);
  }
}
