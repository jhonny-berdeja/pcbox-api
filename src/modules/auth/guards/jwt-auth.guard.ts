import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import { AuthenticatedUser } from '../value-objects/authenticated-user';
import { JwksClientService } from '../jwks-client.service';

const MISSING_TOKEN_MESSAGE = 'Missing or malformed bearer token';
const INVALID_TOKEN_MESSAGE = 'Invalid or expired token';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwksClientService: JwksClientService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const token = extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedException(MISSING_TOKEN_MESSAGE);
    }

    const payload = this.verifyToken(token);
    if (!payload) {
      throw new UnauthorizedException(INVALID_TOKEN_MESSAGE);
    }

    request.user = payload;
    return true;
  }

  private verifyToken(token: string): AuthenticatedUser | null {
    const kid = extractKeyId(token);
    if (!kid) {
      return null;
    }

    const key = this.jwksClientService.getKey(kid);
    if (!key) {
      console.error(`No cached JWKS key for kid "${kid}"`);
      return null;
    }

    try {
      return jwt.verify(token, key, {
        algorithms: ['RS256'],
      }) as unknown as AuthenticatedUser;
    } catch (error) {
      console.error('Failed to verify JWT', error);
      return null;
    }
  }
}

function extractBearerToken(request: Request): string | undefined {
  const header = request.headers.authorization;
  if (!header) {
    return undefined;
  }

  const [type, token] = header.split(' ');
  return type === 'Bearer' && token ? token : undefined;
}

function extractKeyId(token: string): string | undefined {
  const decoded = jwt.decode(token, { complete: true });
  return typeof decoded?.header.kid === 'string'
    ? decoded.header.kid
    : undefined;
}
