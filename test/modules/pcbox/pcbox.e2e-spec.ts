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
 * Real end-to-end: real `PcboxModule` (controller, service,
 * guard, mapper) against a real — if in-memory — database. Only two
 * external boundaries are mocked, because they cannot run in this
 * environment at all: `fetch` (would otherwise hit a real ticket-hub-api)
 * and `AnsibleService` (would otherwise SSH into the real
 * `pcbox` server and run a playbook — see the service's own comment and
 * README's "Manual verification" section for why this can only be
 * confirmed by hand, once deployed).
 */
describe('Pcbox flow (e2e, in-memory DB)', () => {
  let app: INestApplication<App>;
  let moduleFixture: TestingModule;
  let repository: Repository<AdministrationEntity>;
  let executeMock: jest.Mock;
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

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
    process.env.TICKET_HUB_API_URL = 'http://ticket-hub-api.test';
    process.env.TICKET_HUB_API_INTERNAL_KEY = 'test-internal-key';
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
    fetchSpy = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(async () => {
    fetchSpy.mockRestore();
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

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('401s with the wrong key', async () => {
    await request(app.getHttpServer())
      .post('/pcbox')
      .set('x-admin-api-key', 'not-the-real-key')
      .send(validBody())
      .expect(401);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects a non-APPROVED status locally, before ever calling ticket-hub-api', async () => {
    await request(app.getHttpServer())
      .post('/pcbox')
      .set('x-admin-api-key', ADMIN_API_KEY)
      .send({ ...validBody(), status: 'CREATED' })
      .expect(400);

    // The whole point of gate 1 being cheapest-first: fetch must never run.
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(executeMock).not.toHaveBeenCalled();
    await expect(repository.find()).resolves.toHaveLength(0);
  });

  it('422s when ticket-hub-api does not confirm a match, before parsing YAML or saving anything', async () => {
    fetchSpy.mockResolvedValue(new Response(null, { status: 404 }));

    await request(app.getHttpServer())
      .post('/pcbox')
      .set('x-admin-api-key', ADMIN_API_KEY)
      .send({ ...validBody(), fileContent: 'this is: [ not, valid, yaml' })
      .expect(422);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    // Gate 3 (YAML parse) and the playbook run never happen once gate 2 fails.
    expect(executeMock).not.toHaveBeenCalled();
    await expect(repository.find()).resolves.toHaveLength(0);
  });

  it('422s when the ticket-hub-api call itself fails (network error)', async () => {
    fetchSpy.mockRejectedValue(new Error('ECONNREFUSED'));

    await request(app.getHttpServer())
      .post('/pcbox')
      .set('x-admin-api-key', ADMIN_API_KEY)
      .send(validBody())
      .expect(422);

    expect(executeMock).not.toHaveBeenCalled();
  });

  it('400s on unparseable YAML, after ticket-hub-api already matched, before saving anything', async () => {
    fetchSpy.mockResolvedValue(new Response(null, { status: 200 }));

    await request(app.getHttpServer())
      .post('/pcbox')
      .set('x-admin-api-key', ADMIN_API_KEY)
      .send({ ...validBody(), fileContent: 'key: [unclosed' })
      .expect(400);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(executeMock).not.toHaveBeenCalled();
    await expect(repository.find()).resolves.toHaveLength(0);
  });

  it('happy path: saves the record and runs the playbook once all three gates pass', async () => {
    fetchSpy.mockResolvedValue(new Response(null, { status: 200 }));
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
    fetchSpy.mockResolvedValue(new Response(null, { status: 200 }));
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
