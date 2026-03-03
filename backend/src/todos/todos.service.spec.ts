import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TodosService } from './todos.service';
import { Todo, TodoDocument } from './schemas/todo.schema';

function createMockTodo(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: new Types.ObjectId(),
    title: 'Test Todo',
    description: '',
    completed: false,
    priority: 'medium',
    dueDate: undefined,
    user: new Types.ObjectId(),
    createdAt: new Date(),
    updatedAt: new Date(),
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('TodosService', () => {
  let service: TodosService;
  let model: { find: jest.Mock; findOne: jest.Mock; create: jest.Mock; findOneAndDelete: jest.Mock; countDocuments: jest.Mock };

  beforeEach(async () => {
    const mockModel = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      findOneAndDelete: jest.fn(),
      countDocuments: jest.fn(),
    };
    const chain = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn(),
    };
    mockModel.find.mockReturnValue(chain);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TodosService,
        {
          provide: getModelToken(Todo.name),
          useValue: mockModel,
        },
      ],
    }).compile();
    service = module.get<TodosService>(TodosService);
    model = module.get(getModelToken(Todo.name));
  });

  afterEach(() => jest.clearAllMocks());

  describe('findAll', () => {
    const userId = new Types.ObjectId().toString();

    it('returns list with pagination metadata', async () => {
      const items = [createMockTodo(), createMockTodo()];
      jest.spyOn(model, 'find').mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(items),
      } as never);
      jest.spyOn(model, 'countDocuments').mockResolvedValue(2);

      const result = await service.findAll(userId, { page: '1', limit: '20' });

      expect(result.items).toEqual(items);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('applies search filter with escaped regex', async () => {
      const items: TodoDocument[] = [];
      jest.spyOn(model, 'find').mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(items),
      } as never);
      jest.spyOn(model, 'countDocuments').mockResolvedValue(0);

      await service.findAll(userId, { search: 'test (paren)' });

      const findCall = (model.find as jest.Mock).mock.calls[0][0];
      expect(findCall.$or).toHaveLength(2);
      expect(findCall.$or[0].title.$regex).toBe('test \\(paren\\)');
      expect(findCall.$or[0].title.$options).toBe('i');
    });

    it('applies completed filter', async () => {
      jest.spyOn(model, 'find').mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      } as never);
      jest.spyOn(model, 'countDocuments').mockResolvedValue(0);

      await service.findAll(userId, { completed: 'true' });
      expect(model.find).toHaveBeenCalledWith(
        expect.objectContaining({ completed: true }),
        null,
        expect.any(Object),
      );

      await service.findAll(userId, { completed: 'false' });
      expect(model.find).toHaveBeenCalledWith(
        expect.objectContaining({ completed: false }),
        null,
        expect.any(Object),
      );
    });

    it('applies priority filter', async () => {
      jest.spyOn(model, 'find').mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      } as never);
      jest.spyOn(model, 'countDocuments').mockResolvedValue(0);

      await service.findAll(userId, { priority: 'high' });
      expect(model.find).toHaveBeenCalledWith(
        expect.objectContaining({ priority: 'high' }),
        null,
        expect.any(Object),
      );
    });
  });

  describe('create', () => {
    const userId = new Types.ObjectId().toString();

    it('creates and returns a todo', async () => {
      const created = createMockTodo({ title: 'New' });
      jest.spyOn(model, 'create').mockResolvedValue(created);

      const result = await service.create(userId, {
        title: 'New',
        description: '',
        priority: 'medium',
      });

      expect(result).toEqual(created);
      expect(model.create).toHaveBeenCalled();
    });

    it('throws BadRequestException when dueDate is yesterday', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];

      await expect(
        service.create(userId, { title: 'T', dueDate: dateStr }),
      ).rejects.toThrow(BadRequestException);

      expect(model.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when title is whitespace-only', async () => {
      await expect(
        service.create(userId, { title: '   ' }),
      ).rejects.toThrow(BadRequestException);

      expect(model.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    const userId = new Types.ObjectId().toString();
    const todoId = new Types.ObjectId().toString();

    it('updates and calls save', async () => {
      const mockDoc = createMockTodo({ _id: new Types.ObjectId(todoId) });
      jest.spyOn(model, 'findOne').mockResolvedValue(mockDoc);

      const result = await service.update(todoId, userId, {
        title: 'Updated',
      });

      expect(result).toBe(mockDoc);
      expect(mockDoc.save).toHaveBeenCalled();
    });

    it('throws NotFoundException when findOne returns null', async () => {
      jest.spyOn(model, 'findOne').mockResolvedValue(null);

      await expect(
        service.update(todoId, userId, { title: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when dueDate is yesterday', async () => {
      const mockDoc = createMockTodo({ _id: new Types.ObjectId(todoId) });
      jest.spyOn(model, 'findOne').mockResolvedValue(mockDoc);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];

      await expect(
        service.update(todoId, userId, { dueDate: dateStr }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when id is not valid ObjectId', async () => {
      await expect(
        service.update('invalid-id', userId, { title: 'X' }),
      ).rejects.toThrow(BadRequestException);
      expect(model.findOne).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    const userId = new Types.ObjectId().toString();
    const todoId = new Types.ObjectId().toString();

    it('returns success message', async () => {
      const deleted = createMockTodo();
      jest.spyOn(model, 'findOneAndDelete').mockResolvedValue(deleted);

      const result = await service.delete(todoId, userId);

      expect(result).toEqual({ message: 'Todo deleted successfully' });
    });

    it('throws NotFoundException when findOneAndDelete returns null', async () => {
      jest.spyOn(model, 'findOneAndDelete').mockResolvedValue(null);

      await expect(service.delete(todoId, userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when id is not valid ObjectId', async () => {
      await expect(service.delete('invalid-id', userId)).rejects.toThrow(
        BadRequestException,
      );
      expect(model.findOneAndDelete).not.toHaveBeenCalled();
    });
  });

  describe('toggleComplete', () => {
    const userId = new Types.ObjectId().toString();
    const todoId = new Types.ObjectId().toString();

    it('flips false to true and calls save', async () => {
      const mockDoc = createMockTodo({
        _id: new Types.ObjectId(todoId),
        completed: false,
      });
      jest.spyOn(model, 'findOne').mockResolvedValue(mockDoc);

      const result = await service.toggleComplete(todoId, userId);

      expect(result.completed).toBe(true);
      expect(mockDoc.save).toHaveBeenCalled();
    });

    it('flips true to false and calls save', async () => {
      const mockDoc = createMockTodo({
        _id: new Types.ObjectId(todoId),
        completed: true,
      });
      jest.spyOn(model, 'findOne').mockResolvedValue(mockDoc);

      const result = await service.toggleComplete(todoId, userId);

      expect(result.completed).toBe(false);
      expect(mockDoc.save).toHaveBeenCalled();
    });

    it('throws BadRequestException when id is not valid ObjectId', async () => {
      await expect(
        service.toggleComplete('invalid-id', userId),
      ).rejects.toThrow(BadRequestException);
      expect(model.findOne).not.toHaveBeenCalled();
    });
  });
});
