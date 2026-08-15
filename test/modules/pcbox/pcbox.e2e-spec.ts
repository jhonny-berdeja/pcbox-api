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
import { InMemoryDatabaseModule } from '../../common/in-memory-database.module';

/**
 * Real end-to-end: real `PcboxModule` (controller, service, guard, mapper)
 * against a real — if in-memory — database. Only one external boundary is
 * mocked, because it cannot run in this environment at all:
 * `AnsibleService` (would otherwise SSH into the real `pcbox` server and
 * run a playbook — see the service's own comment and README's "Manual
 * verification" section for why this can only be confirmed by hand, once
 * deployed). There's no ticket-hub-api call to mock anymore — that
 * verification step was removed.
 */
describe('Pcbox flow (e2e, in-memory DB)', () => {
  let app: INestApplication<App>;
  let moduleFixture: TestingModule;
  let repository: Repository<AdministrationEntity>;
  let executeMock: jest.Mock;

  const ADMIN_API_KEY = 'test-admin-api-key';

  const validBody = () => ({
    ticketNumber: 1,
    department: 'Datacenter',
    approver: 'Beto',
    informer: 'Ana',
    status: 'APPROVED',
    fileContent: '- hosts: all\n  tasks: []\n',
  });

  beforeAll(async () => {
    process.env.ADMIN_API_KEY = ADMIN_API_KEY;
    process.env.PCBOX_SSH_HOST = '100.64.0.1';
    process.env.PCBOX_SSH_USER = 'jhon';

    executeMock = jest.fn();

    moduleFixture = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        InMemoryDatabaseModule,
        PcboxModule,
      ],
    })
      .overrideProvider(AnsibleService)
      .useValue({ execute: executeMock })
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

  it('401s without the x-admin-api-key header', async () => {
    await request(app.getHttpServer())
      .post('/pcbox')
      .send(validBody())
      .expect(401);

    expect(executeMock).not.toHaveBeenCalled();
  });

  it('401s with the wrong key', async () => {
    await request(app.getHttpServer())
      .post('/pcbox')
      .set('x-admin-api-key', 'not-the-real-key')
      .send(validBody())
      .expect(401);

    expect(executeMock).not.toHaveBeenCalled();
  });

  it('rejects a non-APPROVED status, before parsing YAML or saving anything', async () => {
    await request(app.getHttpServer())
      .post('/pcbox')
      .set('x-admin-api-key', ADMIN_API_KEY)
      .send({ ...validBody(), status: 'CREATED' })
      .expect(400);

    expect(executeMock).not.toHaveBeenCalled();
    await expect(repository.find()).resolves.toHaveLength(0);
  });

  it('400s on unparseable YAML, before saving anything', async () => {
    await request(app.getHttpServer())
      .post('/pcbox')
      .set('x-admin-api-key', ADMIN_API_KEY)
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
      .set('x-admin-api-key', ADMIN_API_KEY)
      .send(validBody())
      .expect(201);

    expect(response.body).toEqual({
      msg: 'Administration saved and playbook execution finished',
      data: {
        id: expect.any(Number) as number,
        ticketNumber: 1,
        department: 'Datacenter',
        approver: 'Beto',
        informer: 'Ana',
        status: 'APPROVED',
        fileContent: validBody().fileContent,
        execution: { success: true, exitCode: 0 },
      },
    });
    // Full stdout/stderr never reach the HTTP response.
    expect(JSON.stringify(response.body)).not.toContain('PLAY [all]');

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
      .set('x-admin-api-key', ADMIN_API_KEY)
      .send(validBody())
      .expect(201);

    const body = response.body as {
      data: { execution: { success: boolean; exitCode: number | null } };
    };
    expect(body.data.execution).toEqual({ success: false, exitCode: 2 });
    await expect(repository.find()).resolves.toHaveLength(1);
  });
});
