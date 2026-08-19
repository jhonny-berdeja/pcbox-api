import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { PcboxModule } from '../../../src/modules/pcbox/pcbox.module';
import { AnsibleService } from '../../../src/modules/ansible/ansible.service';
import { AdministrationEntity } from '../../../src/common/database/administration/administration.entity';
import { JwksClientService } from '../../../src/modules/auth/jwks-client.service';
import { InMemoryDatabaseModule } from '../../common/in-memory-database.module';
import { JwksClientServiceStub } from '../../common/jwks-client-service.stub';
import { signAdminToken } from '../../common/sign-admin-token';

/**
 * Real end-to-end: real `PcboxModule` (controller, service, guards,
 * mapper) against a real — if in-memory — database. `AnsibleService` is
 * mocked (would otherwise SSH into the real `pcbox` server and run a
 * playbook — see the service's own comment). `JwksClientService` is
 * overridden with a stub that hands back a fixed test key synchronously
 * instead of polling auth-api over the network -- there's no real
 * auth-api at `AUTH_API_URL` to poll here, and `signAdminToken` signs
 * test tokens against that same test key.
 */
describe('Pcbox flow (e2e, in-memory DB)', () => {
  let app: INestApplication<App>;
  let moduleFixture: TestingModule;
  let repository: Repository<AdministrationEntity>;
  let executeMock: jest.Mock;
  let adminToken: string;

  const validBody = () => ({
    ticketNumber: 1,
    department: 'Datacenter',
    approver: 'Beto',
    informer: 'ana@example.com',
    status: 'APPROVED',
    fileContent: '- hosts: all\n  tasks: []\n',
  });

  beforeAll(async () => {
    process.env.PCBOX_SSH_HOST = '100.64.0.1';
    process.env.PCBOX_SSH_USER = 'jhon';

    executeMock = jest.fn();
    adminToken = signAdminToken();

    moduleFixture = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        InMemoryDatabaseModule,
        PcboxModule,
      ],
    })
      .overrideProvider(AnsibleService)
      .useValue({ execute: executeMock })
      .overrideProvider(JwksClientService)
      .useClass(JwksClientServiceStub)
      .compile();

    app = moduleFixture.createNestApplication<INestApplication<App>>();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    repository = moduleFixture.get(getRepositoryToken(AdministrationEntity));
  });

  beforeEach(() => {
    executeMock.mockReset();
  });

  afterEach(async () => {
    await repository.clear();
  });

  afterAll(async () => {
    await app.close();
  });

  it('401s without a bearer token', async () => {
    await request(app.getHttpServer())
      .post('/pcbox')
      .send(validBody())
      .expect(401);

    expect(executeMock).not.toHaveBeenCalled();
  });

  it('401s with a malformed token', async () => {
    await request(app.getHttpServer())
      .post('/pcbox')
      .set('Authorization', 'Bearer not-a-real-token')
      .send(validBody())
      .expect(401);

    expect(executeMock).not.toHaveBeenCalled();
  });

  it('rejects a non-APPROVED status, before parsing YAML or saving anything', async () => {
    await request(app.getHttpServer())
      .post('/pcbox')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...validBody(), status: 'CREATED' })
      .expect(400);

    expect(executeMock).not.toHaveBeenCalled();
    await expect(repository.find()).resolves.toHaveLength(0);
  });

  it('400s on unparseable YAML, before saving anything', async () => {
    await request(app.getHttpServer())
      .post('/pcbox')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...validBody(), fileContent: 'key: [unclosed' })
      .expect(400);

    expect(executeMock).not.toHaveBeenCalled();
    await expect(repository.find()).resolves.toHaveLength(0);
  });

  it('happy path: saves the record and runs the playbook once both gates pass', async () => {
    executeMock.mockResolvedValue({
      success: true,
      exitCode: 0,
      stdout: 'PLAY [all] ***',
      stderr: '',
    });

    const response = await request(app.getHttpServer())
      .post('/pcbox')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validBody())
      .expect(201);

    expect(response.body).toEqual({
      msg: 'Administration saved and playbook execution finished',
      data: {
        id: expect.any(Number) as number,
        ticketNumber: 1,
        department: 'Datacenter',
        approver: 'Beto',
        informer: 'ana@example.com',
        status: 'APPROVED',
        fileContent: validBody().fileContent,
        execution: {
          success: true,
          exitCode: 0,
          stdout: 'PLAY [all] ***',
          stderr: '',
        },
      },
    });

    await expect(repository.find()).resolves.toHaveLength(1);
    expect(executeMock).toHaveBeenCalledWith(validBody().fileContent);
  });

  it('surfaces a failed playbook run as a 201 with success:false, not an HTTP error — the record is still saved', async () => {
    executeMock.mockResolvedValue({
      success: false,
      exitCode: 2,
      stdout: '',
      stderr: 'UNREACHABLE',
    });

    const response = await request(app.getHttpServer())
      .post('/pcbox')
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
      exitCode: 2,
      stdout: '',
      stderr: 'UNREACHABLE',
    });
    await expect(repository.find()).resolves.toHaveLength(1);
  });

  it('GET /pcbox/db-targets returns the allowlist, ADMIN-only', async () => {
    const response = await request(app.getHttpServer())
      .get('/pcbox/db-targets')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body).toEqual({
      msg: 'Allowlisted database targets retrieved successfully',
      data: [
        {
          namespace: 'ticket-hub',
          deployment: 'ticket-hub-db',
          dbName: 'ticket-hub-db',
        },
        { namespace: 'pcbox-api', deployment: 'pcbox-db', dbName: 'pcbox-db' },
        { namespace: 'auth-api', deployment: 'auth-db', dbName: 'auth-db' },
      ],
    });

    await request(app.getHttpServer()).get('/pcbox/db-targets').expect(401);
  });

  describe('DATABASE ticketType', () => {
    const databaseBody = () => ({
      ticketNumber: 2,
      department: 'Datacenter',
      approver: 'Beto',
      informer: 'ana@example.com',
      status: 'APPROVED',
      ticketType: 'DATABASE',
      database: {
        namespace: 'pcbox-api',
        deployment: 'pcbox-db',
        dbName: 'pcbox-db',
        operationType: 'LECTURA',
        sqlCode: 'SELECT 1;',
      },
    });

    it('rejects a non-allowlisted target with 400, before saving or executing anything', async () => {
      await request(app.getHttpServer())
        .post('/pcbox')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...databaseBody(),
          database: { ...databaseBody().database, dbName: 'not-allowed-db' },
        })
        .expect(400);

      expect(executeMock).not.toHaveBeenCalled();
      await expect(repository.find()).resolves.toHaveLength(0);
    });

    it('happy path: templates the SQL playbook, persists it, and runs it with sqlCode delivered verbatim', async () => {
      executeMock.mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: '1\n(1 row)',
        stderr: '',
      });

      const response = await request(app.getHttpServer())
        .post('/pcbox')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(databaseBody())
        .expect(201);

      const body = response.body as { data: { fileContent: string } };
      expect(body.data.fileContent).toContain('stdin: SELECT 1;');
      expect(body.data.fileContent).not.toContain('argv:\n        - SELECT');

      await expect(repository.find()).resolves.toHaveLength(1);
      expect(executeMock).toHaveBeenCalledWith(body.data.fileContent);
    });
  });
});
