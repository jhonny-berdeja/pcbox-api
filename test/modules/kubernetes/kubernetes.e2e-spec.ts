import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { KubernetesModule } from '../../../src/modules/kubernetes/kubernetes.module';
import { KubernetesConnector } from '../../../src/modules/kubernetes/kubernetes.connector';
import { KubernetesRegisterEntity } from '../../../src/common/database/administration/kubernetes-register.entity';
import { JwksClientService } from '../../../src/modules/auth/jwks-client.service';
import { InMemoryDatabaseModule } from '../../common/in-memory-database.module';
import { JwksClientServiceStub } from '../../common/jwks-client-service.stub';
import { signAdminToken } from '../../common/sign-admin-token';

/**
 * `KubernetesModule` value-imports `KubernetesConnector`, which
 * value-imports the real (ESM-only) `@kubernetes/client-node` package —
 * ts-jest's CJS loader can't parse it. Mocking it here keeps the real
 * package out of Jest's module graph; `KubernetesConnector` itself is
 * still overridden below via `.useValue()`, so its real constructor
 * (which would call `KubeConfig.loadFromCluster()`) never actually runs.
 */
jest.mock('@kubernetes/client-node', () => ({
  KubeConfig: jest.fn().mockImplementation(() => ({
    loadFromCluster: jest.fn(),
  })),
  KubernetesObjectApi: { makeApiClient: jest.fn() },
  ApiException: class ApiException extends Error {},
  PatchStrategy: { MergePatch: 'application/merge-patch+json' },
}));

/**
 * Real end-to-end: real `KubernetesModule` (controller, service, guards,
 * mapper) against a real — if in-memory — database. `KubernetesConnector`
 * is mocked (would otherwise call the real in-cluster k8s API — see the
 * connector's own comment). `JwksClientService` is overridden with a stub
 * that hands back a fixed test key synchronously, same as the
 * `pcbox`/`database` e2e suites.
 */
describe('Kubernetes flow (e2e, in-memory DB)', () => {
  let app: INestApplication<App>;
  let moduleFixture: TestingModule;
  let repository: Repository<KubernetesRegisterEntity>;
  let applyManifestsMock: jest.Mock;
  let adminToken: string;

  const validBody = () => ({
    ticketNumber: 4,
    department: 'Datacenter',
    approver: 'Beto',
    informer: 'ana@example.com',
    status: 'APPROVED',
    fileContent:
      'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: my-app\n  namespace: ticket-hub\n',
  });

  beforeAll(async () => {
    applyManifestsMock = jest.fn();
    adminToken = signAdminToken();

    moduleFixture = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        InMemoryDatabaseModule,
        KubernetesModule,
      ],
    })
      .overrideProvider(KubernetesConnector)
      .useValue({ applyManifests: applyManifestsMock })
      .overrideProvider(JwksClientService)
      .useClass(JwksClientServiceStub)
      .compile();

    app = moduleFixture.createNestApplication<INestApplication<App>>();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    repository = moduleFixture.get(
      getRepositoryToken(KubernetesRegisterEntity),
    );
  });

  beforeEach(() => {
    applyManifestsMock.mockReset();
  });

  afterEach(async () => {
    await repository.clear();
  });

  afterAll(async () => {
    await app.close();
  });

  it('401s without a bearer token', async () => {
    await request(app.getHttpServer())
      .post('/kubernetes')
      .send(validBody())
      .expect(401);

    expect(applyManifestsMock).not.toHaveBeenCalled();
  });

  it('401s with a malformed token', async () => {
    await request(app.getHttpServer())
      .post('/kubernetes')
      .set('Authorization', 'Bearer not-a-real-token')
      .send(validBody())
      .expect(401);

    expect(applyManifestsMock).not.toHaveBeenCalled();
  });

  it('rejects a non-APPROVED status, before parsing manifests or saving anything', async () => {
    await request(app.getHttpServer())
      .post('/kubernetes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...validBody(), status: 'CREATED' })
      .expect(400);

    expect(applyManifestsMock).not.toHaveBeenCalled();
    await expect(repository.find()).resolves.toHaveLength(0);
  });

  it('400s on unparseable YAML, before saving anything', async () => {
    await request(app.getHttpServer())
      .post('/kubernetes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...validBody(), fileContent: 'key: [unclosed' })
      .expect(400);

    expect(applyManifestsMock).not.toHaveBeenCalled();
    await expect(repository.find()).resolves.toHaveLength(0);
  });

  it('400s on a manifest targeting a non-allowlisted namespace, before saving anything', async () => {
    await request(app.getHttpServer())
      .post('/kubernetes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        ...validBody(),
        fileContent:
          'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: my-app\n  namespace: not-allowed\n',
      })
      .expect(400);

    expect(applyManifestsMock).not.toHaveBeenCalled();
    await expect(repository.find()).resolves.toHaveLength(0);
  });

  it('400s on a manifest with a blocked cluster-scoped kind, before saving anything', async () => {
    await request(app.getHttpServer())
      .post('/kubernetes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        ...validBody(),
        fileContent:
          'apiVersion: v1\nkind: ClusterRole\nmetadata:\n  name: my-role\n  namespace: ticket-hub\n',
      })
      .expect(400);

    expect(applyManifestsMock).not.toHaveBeenCalled();
    await expect(repository.find()).resolves.toHaveLength(0);
  });

  it('happy path: saves the record and applies the manifests once every gate passes', async () => {
    applyManifestsMock.mockResolvedValue({
      success: true,
      applied: [
        {
          kind: 'Deployment',
          namespace: 'ticket-hub',
          name: 'my-app',
          action: 'created',
        },
      ],
      errorMessage: null,
    });

    const response = await request(app.getHttpServer())
      .post('/kubernetes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validBody())
      .expect(201);

    expect(response.body).toEqual({
      msg: 'Execution saved and manifests applied',
      data: {
        id: expect.any(Number) as number,
        ticketNumber: 4,
        department: 'Datacenter',
        approver: 'Beto',
        informer: 'ana@example.com',
        status: 'APPROVED',
        fileContent: validBody().fileContent,
        response: null,
        execution: {
          success: true,
          exitCode: null,
          stdout: 'Deployment/my-app in ticket-hub: created',
          stderr: '',
        },
      },
    });

    await expect(repository.find()).resolves.toHaveLength(1);
    expect(applyManifestsMock).toHaveBeenCalledWith([
      expect.objectContaining({
        kind: 'Deployment',
        metadata: expect.objectContaining({
          name: 'my-app',
          namespace: 'ticket-hub',
        }) as unknown,
      }),
    ]);
  });

  it('surfaces a failed apply as a 201 with success:false, not an HTTP error — the record is still saved', async () => {
    applyManifestsMock.mockResolvedValue({
      success: false,
      applied: [],
      errorMessage: 'Failed to apply Deployment/my-app in ticket-hub: boom',
    });

    const response = await request(app.getHttpServer())
      .post('/kubernetes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validBody())
      .expect(201);

    const body = response.body as {
      data: {
        execution: {
          success: boolean;
          exitCode: number | null;
          stdout: string;
          stderr: string;
        };
      };
    };
    expect(body.data.execution).toEqual({
      success: false,
      exitCode: null,
      stdout: '',
      stderr: 'Failed to apply Deployment/my-app in ticket-hub: boom',
    });
    await expect(repository.find()).resolves.toHaveLength(1);
  });
});
