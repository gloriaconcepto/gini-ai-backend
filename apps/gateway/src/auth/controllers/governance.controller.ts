import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import type { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { AuthenticatedUser } from '../strategies/jwt.strategy';
import { ChangeRequestStoreService } from '../services/change-request-store.service';
import { ChangeRequestExecutorService } from '../services/change-request-executor.service';
import {
  ChangeRequestResponseDto,
  ChangeRequestQueryDto,
  ApproveChangeRequestDto,
  RejectChangeRequestDto,
} from '../dto/governance.dtos';

type AuthRequest = ExpressRequest & { user: AuthenticatedUser };

@ApiTags('Tenant Governance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('maker', 'checker', 'admin')
@Controller('iam/governance/requests')
export class GovernanceController {
  constructor(
    private readonly storeService: ChangeRequestStoreService,
    private readonly executorService: ChangeRequestExecutorService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List all change requests for the tenant realm',
    description:
      'Retrieve pending and historical dual-control change requests filtered by status.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of change requests',
    type: [ChangeRequestResponseDto],
  })
  listRequests(
    @Request() req: AuthRequest,
    @Query() query: ChangeRequestQueryDto,
  ): ChangeRequestResponseDto[] {
    const tenantId = req.user.tenantId!;
    return this.storeService.findAll(tenantId, query.status);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get details of a specific change request',
  })
  @ApiParam({
    name: 'id',
    description: 'Unique change request identifier',
  })
  @ApiResponse({
    status: 200,
    description: 'Details and payload of the requested change request',
    type: ChangeRequestResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Change request not found',
  })
  getRequest(
    @Request() req: AuthRequest,
    @Param('id') id: string,
  ): ChangeRequestResponseDto {
    const tenantId = req.user.tenantId!;
    const request = this.storeService.findById(tenantId, id);
    if (!request) {
      throw new NotFoundException(`Change request with ID '${id}' not found`);
    }
    return request;
  }

  @Post(':id/approve')
  @Roles('checker')
  @ApiOperation({
    summary: 'Approve and execute a pending dual-control change request',
    description:
      'Enforces dual control: the approver must have the checker role and cannot be the maker who initiated the request.',
  })
  @ApiParam({
    name: 'id',
    description: 'Unique change request identifier',
  })
  @ApiResponse({
    status: 200,
    description:
      'Change request approved and executed successfully against Keycloak',
    type: ChangeRequestResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Request is not in PENDING state or has invalid payload',
  })
  @ApiResponse({
    status: 403,
    description:
      'Forbidden - maker cannot approve their own change request or user lacks checker role',
  })
  @ApiResponse({
    status: 404,
    description: 'Change request not found',
  })
  async approveRequest(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() body?: ApproveChangeRequestDto,
  ): Promise<ChangeRequestResponseDto> {
    const tenantId = req.user.tenantId!;
    const request = this.storeService.findById(tenantId, id);

    if (!request) {
      throw new NotFoundException(`Change request with ID '${id}' not found`);
    }

    // Invariant: Maker cannot approve their own change request
    if (request.makerId === req.user.userId) {
      throw new ForbiddenException(
        'Maker cannot approve their own change request (dual-control violation)',
      );
    }

    if (request.status !== 'PENDING') {
      throw new BadRequestException(
        `Cannot approve change request in '${request.status}' status. Only PENDING requests can be approved.`,
      );
    }

    try {
      const executionResult = await this.executorService.execute(request);
      return this.storeService.update(tenantId, id, {
        status: 'APPROVED',
        checkerId: req.user.userId,
        checkerUsername: req.user.username,
        reviewComment: body?.comment,
        executionResult,
        executedAt: new Date(),
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Execution failed';
      this.storeService.update(tenantId, id, {
        executionError: message,
      });
      throw error;
    }
  }

  @Post(':id/reject')
  @Roles('checker')
  @ApiOperation({
    summary: 'Reject a pending dual-control change request',
    description:
      'Allows a Checker to reject a pending change request with a mandatory review comment.',
  })
  @ApiParam({
    name: 'id',
    description: 'Unique change request identifier',
  })
  @ApiResponse({
    status: 200,
    description: 'Change request rejected successfully',
    type: ChangeRequestResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Request is not in PENDING state or comment is missing',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - user lacks checker role',
  })
  @ApiResponse({
    status: 404,
    description: 'Change request not found',
  })
  rejectRequest(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: RejectChangeRequestDto,
  ): ChangeRequestResponseDto {
    const tenantId = req.user.tenantId!;
    const request = this.storeService.findById(tenantId, id);

    if (!request) {
      throw new NotFoundException(`Change request with ID '${id}' not found`);
    }

    if (request.status !== 'PENDING') {
      throw new BadRequestException(
        `Cannot reject change request in '${request.status}' status. Only PENDING requests can be rejected.`,
      );
    }

    return this.storeService.update(tenantId, id, {
      status: 'REJECTED',
      checkerId: req.user.userId,
      checkerUsername: req.user.username,
      reviewComment: body.comment,
    });
  }
}
