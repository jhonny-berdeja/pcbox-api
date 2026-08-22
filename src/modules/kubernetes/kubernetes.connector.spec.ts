import {
  ApiException,
  KubeConfig,
  KubernetesObjectApi,
} from '@kubernetes/client-node';
import { KubernetesConnector } from './kubernetes.connector';
import { K8sManifest } from './kubernetes-manifest.validator';

/**
 * `@kubernetes/client-node` ships as an ESM-only package (`"type":
 * "module"`) — Node's own `require()` can load it directly (verified
 * against the Node version this repo runs), but ts-jest's CJS-oriented
 * module loader cannot parse its `export`/`import` syntax. Mocking it
 * fully here (never `jest.requireActual`) keeps the real ESM files out of
 * Jest's module graph entirely; `ApiException` is reimplemented minimally
 * (`code`/`message`/`body`/`headers`) so `instanceof` checks in
 * `KubernetesConnector` still work against this same mocked class.
 */
jest.mock('@kubernetes/client-node', () => {
  class ApiException extends Error {
    code: number;
    body: unknown;
    headers: Record<string, string>;

    constructor(
      code: number,
      message: string,
      body: unknown,
      headers: Record<string, string>,
    ) {
      super(message);
      this.code = code;
      this.body = body;
      this.headers = headers;
    }
  }

  return {
    KubeConfig: jest.fn().mockImplementation(() => ({
      loadFromCluster: jest.fn(),
    })),
    KubernetesObjectApi: { makeApiClient: jest.fn() },
    ApiException,
    PatchStrategy: { MergePatch: 'application/merge-patch+json' },
  };
});

function buildManifest(overrides: Partial<K8sManifest> = {}): K8sManifest {
  return {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: { name: 'my-app', namespace: 'ticket-hub' },
    ...overrides,
  };
}

describe('KubernetesConnector', () => {
  let mockClient: { read: jest.Mock; create: jest.Mock; patch: jest.Mock };
  let makeApiClientMock: jest.Mock;

  beforeEach(() => {
    mockClient = { read: jest.fn(), create: jest.fn(), patch: jest.fn() };
    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() is not `this`-sensitive
    makeApiClientMock = KubernetesObjectApi.makeApiClient as jest.Mock;
    makeApiClientMock.mockReturnValue(mockClient);
  });

  it('loads in-cluster config and builds the generic client via KubernetesObjectApi.makeApiClient', () => {
    new KubernetesConnector();

    expect(KubeConfig).toHaveBeenCalled();
    expect(makeApiClientMock).toHaveBeenCalled();
  });

  it('creates a manifest when `read` 404s, and records the outcome as "created"', async () => {
    mockClient.read.mockRejectedValue(
      new ApiException(404, 'Not Found', {}, {}),
    );
    mockClient.create.mockResolvedValue({});

    const connector = new KubernetesConnector();
    const result = await connector.applyManifests([buildManifest()]);

    expect(mockClient.create).toHaveBeenCalledTimes(1);
    expect(mockClient.patch).not.toHaveBeenCalled();
    expect(result).toEqual({
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
  });

  it('patches a manifest when `read` finds it, and records the outcome as "configured"', async () => {
    mockClient.read.mockResolvedValue({});
    mockClient.patch.mockResolvedValue({});

    const connector = new KubernetesConnector();
    const result = await connector.applyManifests([buildManifest()]);

    expect(mockClient.patch).toHaveBeenCalledTimes(1);
    expect(mockClient.create).not.toHaveBeenCalled();
    expect(result.applied).toEqual([
      {
        kind: 'Deployment',
        namespace: 'ticket-hub',
        name: 'my-app',
        action: 'configured',
      },
    ]);
    expect(result.success).toBe(true);
  });

  it('re-throws a non-404 error from `read` instead of treating it as "not found"', async () => {
    mockClient.read.mockRejectedValue(
      new ApiException(500, 'Internal Server Error', {}, {}),
    );

    const connector = new KubernetesConnector();
    const result = await connector.applyManifests([buildManifest()]);

    expect(mockClient.create).not.toHaveBeenCalled();
    expect(mockClient.patch).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.applied).toEqual([]);
    expect(result.errorMessage).toContain('Deployment/my-app in ticket-hub');
  });

  it('stops at the first failing manifest, keeping the outcomes of manifests already applied', async () => {
    mockClient.read
      .mockRejectedValueOnce(new ApiException(404, 'Not Found', {}, {}))
      .mockRejectedValueOnce(new ApiException(404, 'Not Found', {}, {}));
    mockClient.create
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('quota exceeded'));

    const connector = new KubernetesConnector();
    const manifests = [
      buildManifest({ metadata: { name: 'first', namespace: 'ticket-hub' } }),
      buildManifest({ metadata: { name: 'second', namespace: 'ticket-hub' } }),
    ];

    const result = await connector.applyManifests(manifests);

    expect(result.success).toBe(false);
    expect(result.applied).toEqual([
      {
        kind: 'Deployment',
        namespace: 'ticket-hub',
        name: 'first',
        action: 'created',
      },
    ]);
    expect(result.errorMessage).toContain('second');
    expect(result.errorMessage).toContain('quota exceeded');
  });
});
