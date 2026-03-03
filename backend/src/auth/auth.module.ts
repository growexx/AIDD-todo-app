import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { User, UserSchema } from './schemas/user.schema';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { EmailService } from './email.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => ({
        secret: config.get('JWT_SECRET') as string,
        signOptions: {
          expiresIn: config.get('JWT_EXPIRES_IN') as string,
        },
      } as JwtModuleOptions),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, EmailService, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
