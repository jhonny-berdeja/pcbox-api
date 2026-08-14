import { UnprocessableEntityException } from '@nestjs/common';
import { TicketHubApiConnector } from './ticket-hub-api.connector';
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

describe('TicketHubVerificationService', () => {
  it('resolves when the connector returns 200', async () => {
    const get = jest
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }));
    const connector = { get } as unknown as TicketHubApiConnector;
    const service = new TicketHubVerificationService(connector);

    await expect(service.verify(buildCriteria())).resolves.toBeUndefined();
  });

  it('calls the connector with the exact path/query ticket-hub-api expects', async () => {
    const get = jest
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }));
    const connector = { get } as unknown as TicketHubApiConnector;
    const service = new TicketHubVerificationService(connector);

    await service.verify(buildCriteria());

    expect(get).toHaveBeenCalledWith(
      '/tickets/1/verify?department=Datacenter&status=APPROVED&informer=Ana&approver=Beto',
    );
  });

  it('rejects on a 404 (no matching ticket)', async () => {
    const get = jest
      .fn()
      .mockResolvedValue(new Response(null, { status: 404 }));
    const connector = { get } as unknown as TicketHubApiConnector;
    const service = new TicketHubVerificationService(connector);

    await expect(service.verify(buildCriteria())).rejects.toThrow(
      UnprocessableEntityException,
    );
  });

  it('rejects on a connector failure, without leaking the underlying error', async () => {
    const get = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const connector = { get } as unknown as TicketHubApiConnector;
    const service = new TicketHubVerificationService(connector);

    await expect(service.verify(buildCriteria())).rejects.toThrow(
      'Ticket does not match the given criteria',
    );
  });
});
