import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Role } from '../role.enum';
import { AuthenticatedUser } from '../authenticated-user';
import { ROLES_KEY } from './roles.decorator';

const MISSING_USER_MESSAGE =
  'RolesGuard ran without an authenticated user - JwtAuthGuard must run first';
const INSUFFICIENT_ROLE_MESSAGE = 'You do not have the required role';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();

    if (!request.user) {
      throw new ForbiddenException(MISSING_USER_MESSAGE);
    }

    if (!hasOneOfRoles(request.user, requiredRoles)) {
      throw new ForbiddenException(INSUFFICIENT_ROLE_MESSAGE);
    }

    return true;
  }
}

function hasOneOfRoles(
  user: AuthenticatedUser,
  requiredRoles: Role[],
): boolean {
  const roleNames = user.apps.application.roles.map((role) => role.name);
  return requiredRoles.some((requiredRole) => roleNames.includes(requiredRole));
}
