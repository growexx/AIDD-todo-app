import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard that protects routes with JWT authentication.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
