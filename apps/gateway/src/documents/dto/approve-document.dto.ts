import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ApproveDocumentDto {
  @ApiPropertyOptional({
    description: 'Optional review comments or sign-off notes from the Checker',
    example: 'Reviewed and compliant with corporate RAG governance policies.',
  })
  @IsOptional()
  @IsString()
  comment?: string;
}

