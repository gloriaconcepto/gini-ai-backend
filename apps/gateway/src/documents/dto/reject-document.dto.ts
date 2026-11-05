import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RejectDocumentDto {
  @ApiProperty({
    description: 'Mandatory justification reason for document rejection',
    example: 'Classification discrepancy: missing required department restrictions.',
  })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

