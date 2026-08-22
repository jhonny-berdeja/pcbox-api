import { BadRequestException } from '@nestjs/common';
import { KubernetesManifestValidator } from './kubernetes-manifest.validator';

const VALID_DEPLOYMENT = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
  namespace: ticket-hub
spec:
  replicas: 1
`;

const VALID_SERVICE = `
apiVersion: v1
kind: Service
metadata:
  name: my-app
  namespace: ticket-hub
`;

describe('KubernetesManifestValidator.assertValidManifests', () => {
  it('parses a single valid manifest document', () => {
    const manifests =
      KubernetesManifestValidator.assertValidManifests(VALID_DEPLOYMENT);

    expect(manifests).toHaveLength(1);
    expect(manifests[0]).toMatchObject({
      kind: 'Deployment',
      apiVersion: 'apps/v1',
      metadata: { name: 'my-app', namespace: 'ticket-hub' },
    });
  });

  it('parses multiple --- separated documents, in order', () => {
    const manifests = KubernetesManifestValidator.assertValidManifests(
      `${VALID_DEPLOYMENT}\n---\n${VALID_SERVICE}`,
    );

    expect(manifests).toHaveLength(2);
    expect(manifests[0].kind).toBe('Deployment');
    expect(manifests[1].kind).toBe('Service');
  });

  it('throws BadRequestException on unparseable YAML', () => {
    expect(() =>
      KubernetesManifestValidator.assertValidManifests('key: [unclosed'),
    ).toThrow(BadRequestException);
  });

  it('throws BadRequestException when there are zero documents', () => {
    expect(() => KubernetesManifestValidator.assertValidManifests('')).toThrow(
      BadRequestException,
    );
  });

  it('throws BadRequestException when a document is missing kind', () => {
    const manifest = `
apiVersion: v1
metadata:
  name: my-app
  namespace: ticket-hub
`;
    expect(() =>
      KubernetesManifestValidator.assertValidManifests(manifest),
    ).toThrow(BadRequestException);
  });

  it('throws BadRequestException when a document is missing metadata.name', () => {
    const manifest = `
apiVersion: v1
kind: ConfigMap
metadata:
  namespace: ticket-hub
`;
    expect(() =>
      KubernetesManifestValidator.assertValidManifests(manifest),
    ).toThrow(BadRequestException);
  });

  it('throws BadRequestException when a document is missing metadata.namespace (no implicit/default namespace allowed)', () => {
    const manifest = `
apiVersion: v1
kind: ConfigMap
metadata:
  name: my-app
`;
    expect(() =>
      KubernetesManifestValidator.assertValidManifests(manifest),
    ).toThrow(BadRequestException);
  });

  it('throws BadRequestException when only one of multiple documents is invalid', () => {
    const manifest = `${VALID_DEPLOYMENT}\n---\napiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: bad\n`;
    expect(() =>
      KubernetesManifestValidator.assertValidManifests(manifest),
    ).toThrow(BadRequestException);
  });
});
