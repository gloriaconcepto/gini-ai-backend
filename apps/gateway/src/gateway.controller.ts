import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { GatewayService } from './gateway.service';
import { Public } from './auth/decorators/public.decorator';
import { SkipAudit } from './audit/decorators/audited.decorator';

@ApiTags('Root')
@Controller()
export class GatewayController {
  constructor(private readonly gatewayService: GatewayService) {}

  @Public()
  @SkipAudit()
  @Get()
  @ApiOperation({ summary: 'Health check / Root endpoint' })
  @ApiResponse({ status: 200, description: 'Service is healthy.' })
  getHello(): string {
    return this.gatewayService.getHello();
  }
}
