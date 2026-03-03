import { Controller, Get } from '@nestjs/common';

/**
 * Health check controller for liveness/readiness probes.
 */
@Controller('api/health')
export class HealthController {
  /**
   * Returns service health status.
   * @returns Object with status and timestamp
   */
  @Get()
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
