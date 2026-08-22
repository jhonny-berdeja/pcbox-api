import { BadRequestException } from '@nestjs/common';
import { loadAll } from 'js-yaml';

const INVALID_YAML_MESSAGE =
  'fileContent is not valid YAML — cannot parse it as Kubernetes manifests';
const NO_DOCUMENTS_MESSAGE = 'fileContent does not contain any YAML documents';

/**
 * Permissive shape for a parsed Kubernetes manifest document — just enough
 * to validate/route/apply it (`kind`, `apiVersion`, `metadata.name`,
 * `metadata.namespace`) while letting arbitrary `spec`/other fields pass
 * through untouched to the k8s API.
 */
export interface K8sManifest {
  kind: string;
  apiVersion: string;
  metadata: {
    name: string;
    namespace: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export class KubernetesManifestValidator {
  /**
   * Parses `fileContent` as multi-document (`---`-separated) YAML and
   * validates every document has the fields `KubernetesConnector` and
   * `K8sTargetValidator` need. `namespace` must be explicit in each
   * manifest — no implicit/default namespace — so the namespace allowlist
   * check downstream is never ambiguous about which namespace it is
   * actually gating.
   */
  static assertValidManifests(fileContent: string): K8sManifest[] {
    const documents = KubernetesManifestValidator.parseYaml(fileContent);

    if (documents.length === 0) {
      throw new BadRequestException(NO_DOCUMENTS_MESSAGE);
    }

    documents.forEach((document, index) =>
      KubernetesManifestValidator.assertHasRequiredFields(document, index),
    );

    return documents as K8sManifest[];
  }

  private static parseYaml(fileContent: string): unknown[] {
    try {
      const documents = loadAll(fileContent);
      return documents.filter(
        (document) => document !== null && document !== undefined,
      );
    } catch {
      throw new BadRequestException(INVALID_YAML_MESSAGE);
    }
  }

  private static assertHasRequiredFields(
    document: unknown,
    index: number,
  ): void {
    const message = `Manifest at document #${index + 1} is missing a required field (kind, metadata.name, or metadata.namespace)`;

    if (!isPlainObject(document)) {
      throw new BadRequestException(message);
    }

    const { kind, metadata } = document;
    if (!isNonEmptyString(kind)) {
      throw new BadRequestException(message);
    }

    if (!isPlainObject(metadata)) {
      throw new BadRequestException(message);
    }

    if (!isNonEmptyString(metadata.name)) {
      throw new BadRequestException(message);
    }

    if (!isNonEmptyString(metadata.namespace)) {
      throw new BadRequestException(message);
    }
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}
