export interface RolePayload {
  id: number;
  name: string;
  description: string;
}

export interface ApplicationPayload {
  id: number;
  name: string;
  description: string;
  roles: RolePayload[];
}

export interface AuthenticatedUser {
  sub: number;
  apps: {
    application: ApplicationPayload;
  };
}
