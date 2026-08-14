import { UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  TicketHubVerificationService,
  TicketVerificationCriteria,
} from './ticket-hub-verification.service';

function buildCriteria(): TicketVerificationCriteria {
  return {
    ticketNumber: 1,
    department: 'Datacenter',
    approver: 'Beto',
    informer: 'Ana',
    status: 'APPROVED',
  };
}

function buildConfigService(): ConfigService {
  const values: Record<string, string> = {
    TICKET_HUB_API_URL: 'http://ticket-hub-api.test',
    TICKET_HUB_API_INTERNAL_KEY: 'test-internal-key',
  };
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

describe('TicketHubVerificationService', () => {
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    fetchSpy = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('resolves when ticket-hub-api answers 200', async () => {
    fetchSpy.mockResolvedValue(new Response(null, { status: 200 }));
    const service = new TicketHubVerificationService(buildConfigService());

    await expect(service.verify(buildCriteria())).resolves.toBeUndefined();
  });

  it('calls the exact URL/query/header contract ticket-hub-api expects', async () => {
    fetchSpy.mockResolvedValue(new Response(null, { status: 200 }));
    const service = new TicketHubVerificationService(buildConfigService());

    await service.verify(buildCriteria());

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://ticket-hub-api.test/tickets/1/verify?department=Datacenter&status=APPROVED&informer=Ana&approver=Beto',
      expect.objectContaining({
        method: 'GET',
        headers: { 'x-internal-api-key': 'test-internal-key' },
      }) as unknown,
    );
  });

  it('rejects on a 404 (no matching ticket)', async () => {
    fetchSpy.mockResolvedValue(new Response(null, { status: 404 }));
    const service = new TicketHubVerificationService(buildConfigService());

    await expect(service.verify(buildCriteria())).rejects.toThrow(
      UnprocessableEntityException,
    );
  });

  it('rejects on a network failure, without leaking the underlying error', async () => {
    fetchSpy.mockRejectedValue(new Error('ECONNREFUSED'));
    const service = new TicketHubVerificationService(buildConfigService());

    await expect(service.verify(buildCriteria())).rejects.toThrow(
      'Ticket does not match the given criteria',
    );
  });
});
