import { ApiPropertyOptional } from '@nestjs/swagger';
import { PartialType } from '@nestjs/swagger';
import { IsOptional, IsBoolean } from 'class-validator';
import { CreateTodoDto } from './create-todo.dto';

/**
 * DTO for updating an existing todo (partial).
 */
export class UpdateTodoDto extends PartialType(CreateTodoDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}
