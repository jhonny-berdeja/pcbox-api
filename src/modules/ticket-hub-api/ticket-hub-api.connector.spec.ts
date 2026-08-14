import { ConfigService } from '@nestjs/config';
import { TicketHubApiConnector } from './ticket-hub-api.connector';

function buildConfigService(): ConfigService {
  const values: Record<string, string> = {
    TICKET_HUB_API_URL: 'http://ticket-hub-api.test',
    TICKET_HUB_API_INTERNAL_KEY: 'test-internal-key',
  };
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

describe('TicketHubApiConnector', () => {
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    fetchSpy = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('builds the full URL from the configured base + path, with the shared-secret header', async () => {
    fetchSpy.mockResolvedValue(new Response(null, { status: 200 }));
    const connector = new TicketHubApiConnector(buildConfigService());

    await connector.get('/tickets/1/verify?department=Datacenter');

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://ticket-hub-api.test/tickets/1/verify?department=Datacenter',
      expect.objectContaining({
        method: 'GET',
        headers: { 'x-internal-api-key': 'test-internal-key' },
      }) as unknown,
    );
  });

  it('returns the raw Response on success', async () => {
    const response = new Response(null, { status: 200 });
    fetchSpy.mockResolvedValue(response);
    const connector = new TicketHubApiConnector(buildConfigService());

    const result = await connector.get('/tickets/1/verify');

    expect(result).toBe(response);
  });

  it('propagates a fetch rejection (network error)', async () => {
    fetchSpy.mockRejectedValue(new Error('ECONNREFUSED'));
    const connector = new TicketHubApiConnector(buildConfigService());

    await expect(connector.get('/tickets/1/verify')).rejects.toThrow(
      'ECONNREFUSED',
    );
  });
});
