import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { User } from './schemas/user.schema';

const mockUser = {
  _id: 'user-id-123',
  name: 'Alice',
  email: 'alice@todoapp.com',
  password: 'hashed',
  comparePassword: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;
  let userModel: { findOne: jest.Mock };
  let jwtService: { sign: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getModelToken(User.name),
          useValue: { findOne: jest.fn() },
        },
        { provide: JwtService, useValue: { sign: jest.fn().mockReturnValue('mock-token') } },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('7d') } },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userModel = module.get(getModelToken(User.name));
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('validateUser', () => {
    it('returns user when found and password matches', async () => {
      (mockUser.comparePassword as jest.Mock).mockResolvedValue(true);
      jest.spyOn(userModel, 'findOne').mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      const result = await service.validateUser('alice@todoapp.com', 'Alice@123');

      expect(result).toEqual(mockUser);
      expect(userModel.findOne).toHaveBeenCalledWith({ email: 'alice@todoapp.com' });
      expect(mockUser.comparePassword).toHaveBeenCalledWith('Alice@123');
    });

    it('returns null when user not found', async () => {
      jest.spyOn(userModel, 'findOne').mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      const result = await service.validateUser('unknown@todoapp.com', 'pass');

      expect(result).toBeNull();
    });

    it('returns null when password does not match', async () => {
      (mockUser.comparePassword as jest.Mock).mockResolvedValue(false);
      jest.spyOn(userModel, 'findOne').mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      const result = await service.validateUser('alice@todoapp.com', 'WrongPass');

      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('returns access_token and user with id, name, email', () => {
      const result = service.login(mockUser as never);

      expect(result.access_token).toBe('mock-token');
      expect(result.user).toEqual({
        id: 'user-id-123',
        name: 'Alice',
        email: 'alice@todoapp.com',
      });
      expect(jwtService.sign).toHaveBeenCalledWith(
        { email: 'alice@todoapp.com', sub: 'user-id-123' },
        expect.objectContaining({ expiresIn: '7d' }),
      );
    });
  });
});
