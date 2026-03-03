import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test-secret') },
        },
      ],
    }).compile();
    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('validate returns userId and email from payload', () => {
    const payload = { sub: 'user123', email: 'a@b.com' };
    const result = strategy.validate(payload);
    expect(result).toEqual({ userId: 'user123', email: 'a@b.com' });
  });
});
