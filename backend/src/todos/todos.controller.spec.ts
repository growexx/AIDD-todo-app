import { Test, TestingModule } from '@nestjs/testing';
import { TodosController } from './todos.controller';
import { TodosService } from './todos.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

describe('TodosController', () => {
  let controller: TodosController;
  let todosService: TodosService;

  const mockTodosService = {
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    toggleComplete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TodosController],
      providers: [
        { provide: TodosService, useValue: mockTodosService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<TodosController>(TodosController);
    todosService = module.get<TodosService>(TodosService);
  });

  afterEach(() => jest.clearAllMocks());

  it('GET / calls todosService.findAll with userId from req.user', async () => {
    const req = { user: { userId: 'user-id-123' } };
    const query = { page: '1', limit: '20' };
    mockTodosService.findAll.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });

    await controller.findAll(req as never, query as never);

    expect(todosService.findAll).toHaveBeenCalledWith('user-id-123', query);
  });

  it('POST / calls todosService.create', async () => {
    const req = { user: { userId: 'user-id-123' } };
    const dto = { title: 'New Todo', priority: 'medium' as const };
    mockTodosService.create.mockResolvedValue({ _id: 'id', title: 'New Todo' });

    await controller.create(req as never, dto as never);

    expect(todosService.create).toHaveBeenCalledWith('user-id-123', dto);
  });

  it('PATCH /:id calls todosService.update', async () => {
    const req = { user: { userId: 'user-id-123' } };
    const id = 'todo-id-456';
    const dto = { title: 'Updated' };
    mockTodosService.update.mockResolvedValue({ _id: id, title: 'Updated' });

    await controller.update(id, req as never, dto as never);

    expect(todosService.update).toHaveBeenCalledWith(id, 'user-id-123', dto);
  });

  it('DELETE /:id calls todosService.delete', async () => {
    const req = { user: { userId: 'user-id-123' } };
    const id = 'todo-id-456';
    mockTodosService.delete.mockResolvedValue({ message: 'Todo deleted successfully' });

    await controller.delete(id, req as never);

    expect(todosService.delete).toHaveBeenCalledWith(id, 'user-id-123');
  });

  it('PATCH /:id/toggle calls todosService.toggleComplete', async () => {
    const req = { user: { userId: 'user-id-123' } };
    const id = 'todo-id-456';
    mockTodosService.toggleComplete.mockResolvedValue({ _id: id, completed: true });

    await controller.toggleComplete(id, req as never);

    expect(todosService.toggleComplete).toHaveBeenCalledWith(id, 'user-id-123');
  });
});
