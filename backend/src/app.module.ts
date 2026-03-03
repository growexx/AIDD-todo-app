import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { HealthController } from './health.controller';
import { AuthModule } from './auth/auth.module';
import { TodosModule } from './todos/todos.module';
import { RbacModule } from './rbac/rbac.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGODB_URI'),
        serverSelectionTimeoutMS: 10000,
        retryWrites: true,
        retryReads: true,
      }),
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }]),
    AuthModule,
    TodosModule,
    RbacModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
