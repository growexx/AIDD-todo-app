import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Todo, TodoDocument } from './schemas/todo.schema';
import { CreateTodoDto } from './dto/create-todo.dto';
import { UpdateTodoDto } from './dto/update-todo.dto';
import { TodoQuery } from './types/todo-query.interface';

/**
 * CRUD and business logic for todos.
 */
@Injectable()
export class TodosService {
  constructor(
    @InjectModel(Todo.name) private readonly todoModel: Model<TodoDocument>,
  ) {}

  private isPastDate(dateStr: string): boolean {
    const parsedDate = new Date(dateStr);
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    return parsedDate < todayMidnight;
  }

  /**
   * Returns paginated todos for a user with optional search and filters.
   */
  async findAll(
    userId: string,
    query: TodoQuery,
  ): Promise<{
    items: TodoDocument[];
    total: number;
    page: number;
    limit: number;
  }> {
    const filter: Record<string, unknown> = { user: new Types.ObjectId(userId) };

    if (query.search) {
      const escapedSearch = query.search.replace(
        /[.*+?^${}()|[\]\\]/g,
        '\\$&',
      );
      filter.$or = [
        { title: { $regex: escapedSearch, $options: 'i' } },
        { description: { $regex: escapedSearch, $options: 'i' } },
      ];
    }

    if (query.completed === 'true') filter.completed = true;
    if (query.completed === 'false') filter.completed = false;
    if (query.priority) filter.priority = query.priority;

    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
    const skip = (page - 1) * limit;

    const items = await this.todoModel
      .find(filter, null, { sort: { createdAt: -1 } })
      .skip(skip)
      .limit(limit)
      .lean<TodoDocument[]>();
    const total = await this.todoModel.countDocuments(filter);

    return { items, total, page, limit };
  }

  /**
   * Creates a new todo for the user.
   */
  async create(userId: string, dto: CreateTodoDto): Promise<TodoDocument> {
    const title = typeof dto.title === 'string' ? dto.title.trim() : '';
    if (!title) {
      throw new BadRequestException('Title cannot be empty');
    }
    if (dto.dueDate && this.isPastDate(dto.dueDate)) {
      throw new BadRequestException('Due date cannot be in the past');
    }
    return this.todoModel.create({
      ...dto,
      title,
      user: new Types.ObjectId(userId),
    });
  }

  /**
   * Updates an existing todo by id (user-scoped).
   */
  async update(
    id: string,
    userId: string,
    dto: UpdateTodoDto,
  ): Promise<TodoDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid ID format');
    }
    const todo = await this.todoModel.findOne({
      _id: new Types.ObjectId(id),
      user: new Types.ObjectId(userId),
    });
    if (!todo) throw new NotFoundException('Todo not found');
    if (dto.dueDate && this.isPastDate(dto.dueDate)) {
      throw new BadRequestException('Due date cannot be in the past');
    }
    if (dto.title !== undefined) todo.title = dto.title;
    if (dto.description !== undefined) todo.description = dto.description ?? '';
    if (dto.completed !== undefined) todo.completed = dto.completed;
    if (dto.priority !== undefined) todo.priority = dto.priority;
    if (dto.dueDate !== undefined) todo.dueDate = dto.dueDate ? new Date(dto.dueDate) : undefined;
    (todo as { updatedAt?: Date }).updatedAt = new Date();
    await todo.save();
    return todo;
  }

  /**
   * Deletes a todo by id (user-scoped).
   */
  async delete(id: string, userId: string): Promise<{ message: string }> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid ID format');
    }
    const deleted = await this.todoModel.findOneAndDelete({
      _id: new Types.ObjectId(id),
      user: new Types.ObjectId(userId),
    });
    if (!deleted) throw new NotFoundException('Todo not found');
    return { message: 'Todo deleted successfully' };
  }

  /**
   * Toggles the completed flag of a todo.
   */
  async toggleComplete(
    id: string,
    userId: string,
  ): Promise<TodoDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid ID format');
    }
    const todo = await this.todoModel.findOne({
      _id: new Types.ObjectId(id),
      user: new Types.ObjectId(userId),
    });
    if (!todo) throw new NotFoundException('Todo not found');
    todo.completed = !todo.completed;
    (todo as { updatedAt?: Date }).updatedAt = new Date();
    await todo.save();
    return todo;
  }
}
