import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TodosService } from './todos.service';
import { CreateTodoDto } from './dto/create-todo.dto';
import { UpdateTodoDto } from './dto/update-todo.dto';
import type { TodoQuery } from './types/todo-query.interface';

interface RequestWithUser {
  user: { userId: string };
}

/**
 * REST API for todo CRUD and toggle complete.
 */
@ApiTags('Todos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/todos')
export class TodosController {
  constructor(private readonly todosService: TodosService) {}

  @Get()
  @ApiOperation({ summary: 'List todos with filters and pagination' })
  @ApiResponse({ status: 200, description: 'Paginated list of todos' })
  @ApiResponse({ status: 401, description: 'Unauthorised' })
  findAll(@Req() req: RequestWithUser, @Query() query: TodoQuery) {
    return this.todosService.findAll(req.user.userId, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new todo' })
  @ApiResponse({ status: 200, description: 'Todo created' })
  @ApiResponse({ status: 401, description: 'Unauthorised' })
  create(@Req() req: RequestWithUser, @Body() dto: CreateTodoDto) {
    return this.todosService.create(req.user.userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a todo' })
  @ApiResponse({ status: 200, description: 'Todo updated' })
  @ApiResponse({ status: 401, description: 'Unauthorised' })
  update(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
    @Body() dto: UpdateTodoDto,
  ) {
    return this.todosService.update(id, req.user.userId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a todo' })
  @ApiResponse({ status: 200, description: 'Todo deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorised' })
  delete(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.todosService.delete(id, req.user.userId);
  }

  @Patch(':id/toggle')
  @ApiOperation({ summary: 'Toggle todo completed state' })
  @ApiResponse({ status: 200, description: 'Todo toggled' })
  @ApiResponse({ status: 401, description: 'Unauthorised' })
  toggleComplete(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.todosService.toggleComplete(id, req.user.userId);
  }
}
