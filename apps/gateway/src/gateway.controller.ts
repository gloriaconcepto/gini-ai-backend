import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { GatewayService } from './gateway.service';

@ApiTags('Root')
@Controller()
export class GatewayController {
  constructor(private readonly gatewayService: GatewayService) {}

  @Get()
  @ApiOperation({ summary: 'Health check / Root endpoint' })
  @ApiResponse({ status: 200, description: 'Service is healthy.' })
  getHello(): string {
    return this.gatewayService.getHello();
  }
}
