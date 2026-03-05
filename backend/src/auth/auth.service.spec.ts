import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { User } from './schemas/user.schema';
import { EmailService } from './email.service';

const createChain = (resolved: unknown) => {
  const execPromise = Promise.resolve(resolved);
  return {
    select: jest.fn().mockReturnValue({
      exec: jest.fn().mockReturnValue(execPromise),
      then: execPromise.then.bind(execPromise),
      catch: execPromise.catch.bind(execPromise),
    }),
  };
};

const mockUser = {
  _id: { toString: () => 'user-id-123' },
  name: 'Alice',
  email: 'alice@todoapp.com',
  password: 'hashed',
  failedLoginAttempts: 0,
  lockedUntil: undefined,
  mfaEnabled: false,
  comparePassword: jest.fn(),
  save: jest.fn().mockResolvedValue(undefined),
};

describe('AuthService', () => {
  let service: AuthService;
  let userModel: { findOne: jest.Mock; updateOne: jest.Mock };
  let jwtService: { sign: jest.Mock };
  let configGet: jest.Mock;

  beforeEach(async () => {
    configGet = jest.fn((key: string) => {
      if (key === 'JWT_EXPIRES_IN') return '7d';
      if (key === 'JWT_SECRET') return 'secret';
      if (key === 'MFA_ENCRYPTION_KEY') return '0'.repeat(64);
      if (key === 'TEMP_JWT_TTL') return '10m';
      return undefined;
    });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getModelToken(User.name),
          useValue: {
            findOne: jest.fn(),
            updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
          },
        },
        { provide: JwtService, useValue: { sign: jest.fn().mockReturnValue('mock-token') } },
        { provide: ConfigService, useValue: { get: configGet } },
        { provide: EmailService, useValue: { sendAccountLockedEmail: jest.fn().mockResolvedValue(undefined) } },
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
      userModel.findOne.mockReturnValue(createChain(mockUser));

      const result = await service.validateUser('alice@todoapp.com', 'Alice@123');

      expect(result).toEqual(mockUser);
      expect(userModel.findOne).toHaveBeenCalledWith({ email: 'alice@todoapp.com' });
      expect(mockUser.comparePassword).toHaveBeenCalledWith('Alice@123');
    });

    it('returns null when user not found', async () => {
      userModel.findOne.mockReturnValue(createChain(null));

      const result = await service.validateUser('unknown@todoapp.com', 'pass');

      expect(result).toBeNull();
    });

    it('returns null when password does not match', async () => {
      (mockUser.comparePassword as jest.Mock).mockResolvedValue(false);
      userModel.findOne.mockReturnValue(createChain(mockUser));

      const result = await service.validateUser('alice@todoapp.com', 'WrongPass');

      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('returns access_token and user when password valid and MFA disabled', async () => {
      (mockUser.comparePassword as jest.Mock).mockResolvedValue(true);
      userModel.findOne.mockReturnValue(createChain(mockUser));

      const result = await service.login('alice@todoapp.com', 'Alice@123');

      expect(result).toHaveProperty('access_token', 'mock-token');
      expect(result).toHaveProperty('user', {
        id: 'user-id-123',
        name: 'Alice',
        email: 'alice@todoapp.com',
      });
      expect(jwtService.sign).toHaveBeenCalledWith(
        { email: 'alice@todoapp.com', sub: 'user-id-123' },
        expect.objectContaining({ expiresIn: '7d' }),
      );
    });

    it('throws UnauthorizedException when user not found', async () => {
      userModel.findOne.mockReturnValue(createChain(null));

      await expect(service.login('unknown@todoapp.com', 'pass')).rejects.toThrow(UnauthorizedException);
    });

    it('throws ForbiddenException when account is locked', async () => {
      const lockedUser = { ...mockUser, lockedUntil: new Date(Date.now() + 60000) };
      userModel.findOne.mockReturnValue(createChain(lockedUser));

      await expect(service.login('alice@todoapp.com', 'Alice@123')).rejects.toThrow(ForbiddenException);
    });

    it('returns requiresMfa and mfaPendingToken when password valid and mfaEnabled', async () => {
      (mockUser.comparePassword as jest.Mock).mockResolvedValue(true);
      const withMfa = { ...mockUser, mfaEnabled: true };
      userModel.findOne.mockReturnValue(createChain(withMfa));
      (jwtService.sign as jest.Mock).mockReturnValue('mfa-pending-token');

      const result = await service.login('alice@todoapp.com', 'Alice@123');

      expect(result).toEqual({ requiresMfa: true, mfaPendingToken: 'mfa-pending-token' });
    });
  });
});
