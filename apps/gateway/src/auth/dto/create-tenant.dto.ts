import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class CreateTenantDto {
  @ApiProperty({ description: 'The display name of the tenant', example: 'Acme Corp' })
  @IsString()
  @IsNotEmpty()
  tenantName: string;
}

