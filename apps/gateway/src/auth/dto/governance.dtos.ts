import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';
import type {
  ChangeRequestActionType,
  ChangeRequestStatus,
} from '../entities/change-request.entity';

export class ChangeRequestResponseDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Unique identifier of the change request',
  })
  id: string;

  @ApiProperty({
    example: 'acme-corp',
    description: 'Tenant ID where this change request belongs',
  })
  tenantId: string;

  @ApiProperty({
    example: 'CREATE_USER',
    description: 'Type of administrative action being requested',
  })
  actionType: ChangeRequestActionType;

  @ApiProperty({
    example: 'users',
    description: 'Target resource domain (users, roles, clients, idp)',
  })
  targetResource: string;

  @ApiPropertyOptional({
    example: 'user-456',
    description: 'Identifier of the targeted entity if applicable',
  })
  targetResourceId?: string;

  @ApiProperty({
    example: { username: 'jdoe', email: 'jdoe@example.com' },
    description: 'Payload data captured for execution upon checker approval',
  })
  payload: Record<string, any>;

  @ApiProperty({
    example: 'user-maker-uuid',
    description: 'User ID of the Maker who submitted this request',
  })
  makerId: string;

  @ApiProperty({
    example: 'maker@acme.com',
    description: 'Username of the Maker who submitted this request',
  })
  makerUsername: string;

  @ApiPropertyOptional({
    example: 'user-checker-uuid',
    description: 'User ID of the Checker who reviewed this request',
  })
  checkerId?: string;

  @ApiPropertyOptional({
    example: 'checker@acme.com',
    description: 'Username of the Checker who reviewed this request',
  })
  checkerUsername?: string;

  @ApiProperty({
    example: 'PENDING',
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'EXECUTED'],
    description: 'Current governance state of the change request',
  })
  status: ChangeRequestStatus;

  @ApiPropertyOptional({
    example: 'Approved per security board review',
    description: 'Checker review notes or rejection reason',
  })
  reviewComment?: string;

  @ApiPropertyOptional({
    description: 'Result returned by Keycloak upon successful execution',
  })
  executionResult?: any;

  @ApiPropertyOptional({
    example: 'User already exists',
    description: 'Execution error message if execution failed',
  })
  executionError?: string;

  @ApiProperty({
    example: '2026-09-08T14:30:00.000Z',
    description: 'Timestamp when request was initiated',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2026-09-08T14:35:00.000Z',
    description: 'Timestamp when request was last updated',
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    example: '2026-09-08T14:35:00.000Z',
    description: 'Timestamp when request was executed against Keycloak',
  })
  executedAt?: Date;
}

export class ChangeRequestQueryDto {
  @ApiPropertyOptional({
    example: 'PENDING',
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'EXECUTED'],
    description: 'Filter change requests by status',
  })
  @IsOptional()
  @IsIn(['PENDING', 'APPROVED', 'REJECTED', 'EXECUTED'])
  status?: ChangeRequestStatus;
}

export class ApproveChangeRequestDto {
  @ApiPropertyOptional({
    example: 'Approved after verification',
    description: 'Optional approval notes or audit comment',
  })
  @IsOptional()
  @IsString()
  comment?: string;
}

export class RejectChangeRequestDto {
  @ApiProperty({
    example: 'Missing authorization approval ticket from IT Security',
    description: 'Mandatory reason for rejecting the change request',
  })
  @IsString()
  @IsNotEmpty()
  comment: string;
}
