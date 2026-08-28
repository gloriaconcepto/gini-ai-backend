import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { GatewayService } from './gateway.service';
import { Public } from './auth/public.decorator';

@ApiTags('Root')
@Controller()
export class GatewayController {
  constructor(private readonly gatewayService: GatewayService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Health check / Root endpoint' })
  @ApiResponse({ status: 200, description: 'Service is healthy.' })
  getHello(): string {
    return this.gatewayService.getHello();
  }
}
