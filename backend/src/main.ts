import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { createRedisClient } from './common/lib/redis';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const demoAuth = configService.get('DEMO_AUTH') === 'true';
  const nodeEnv = configService.get('NODE_ENV');
  if (nodeEnv === 'production' && demoAuth) {
    throw new Error('FATAL: DEMO_AUTH must not be enabled in production');
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  app.use(compression());
  app.use(helmet());

  if (demoAuth) {
    const logger = new Logger('Bootstrap');
    logger.warn('⚠️  DEMO AUTH MIDDLEWARE ACTIVE — NOT FOR PRODUCTION');
    const demoUserId = configService.get('DEMO_USER_ID') || 'demo-user-001';
    app.use((req: { user?: { userId: string }; headers: { [k: string]: string | undefined } }, _res, next) => {
      const id = req.headers['x-demo-user-id'] || demoUserId;
      req.user = { userId: id };
      next();
    });
  }

  await createRedisClient();

  const clientUrl = configService.get('CLIENT_URL') || 'http://localhost:3000';
  app.enableCors({
    origin: clientUrl,
    credentials: true,
  });

  if (configService.get('NODE_ENV') !== 'production') {
    const { DocumentBuilder, SwaggerModule } = await import(
      '@nestjs/swagger'
    );
    const config = new DocumentBuilder()
      .setTitle('Todo API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = configService.get('PORT') || 5000;
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`Application running on http://localhost:${port}`);
  if (configService.get('NODE_ENV') !== 'production') {
    logger.log(`Swagger docs at http://localhost:${port}/api/docs`);
  }
}

bootstrap();
