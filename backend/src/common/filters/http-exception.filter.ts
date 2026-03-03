import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Global exception filter that normalizes all error responses.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const path = request.url;
    const timestamp = new Date().toISOString();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'object' && res !== null && 'error' in res) {
        const err = (res as { error: { code?: string; message?: string; details?: unknown } }).error;
        response.status(status).json({ error: err, timestamp, path });
        return;
      }
      message = typeof res === 'string' ? res : (res as { message?: string }).message ?? message;
      if (Array.isArray(message)) {
        message = message.join(', ');
      }
    }

    this.logger.error(
      `${request.method} ${path} ${status} - ${message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      timestamp,
      path,
    });
  }
}
