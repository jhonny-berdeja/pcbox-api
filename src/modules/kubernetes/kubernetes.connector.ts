import { Injectable } from '@nestjs/common';
import {
  ApiException,
  KubeConfig,
  KubernetesObjectApi,
  PatchStrategy,
} from '@kubernetes/client-node';
import { K8sManifest } from './kubernetes-manifest.validator';

export interface K8sManifestOutcome {
  kind: string;
  namespace: string;
  name: string;
  action: 'created' | 'configured';
}

export interface K8sApplyResult {
  success: boolean;
  applied: K8sManifestOutcome[];
  errorMessage: string | null;
}

/**
 * Talks to the k8s API instead of SSH (compare `AnsibleConnector`) — pure
 * I/O, no business decisions. pcbox-api runs as a Pod *inside* the microk8s
 * cluster it manages (see `infra-hub/apps/pcbox-api/deployment.yaml`'s
 * deploy workflow), so auth is in-cluster via `KubeConfig.loadFromCluster()`
 * and the Pod's own ServiceAccount token — no kubeconfig secret to wire up.
 *
 * Uses `KubernetesObjectApi`, the generic/dynamic client that works for any
 * `kind`/`apiVersion` via URI discovery, rather than a per-kind typed
 * client, since manifests here are arbitrary user-supplied YAML.
 */
@Injectable()
export class KubernetesConnector {
  /**
   * 30 seconds per manifest call — k8s API calls are fast, unlike the
   * 4-minute SSH playbook timeout `AnsibleConnector` uses.
   */
  private static readonly APPLY_TIMEOUT_MS = 30_000;

  private readonly client: KubernetesObjectApi;

  constructor() {
    const kubeConfig = new KubeConfig();
    kubeConfig.loadFromCluster();
    this.client = KubernetesObjectApi.makeApiClient(kubeConfig);
  }

  /**
   * Applies every manifest in document order: `read` first to decide
   * create vs. patch (404 → create, anything else present → patch as a
   * server-side merge patch). Stops at the first manifest that fails —
   * same "no transactionality" spirit as the ansible-playbook path, which
   * can't roll back mid-playbook either.
   */
  async applyManifests(manifests: K8sManifest[]): Promise<K8sApplyResult> {
    const applied: K8sManifestOutcome[] = [];

    for (const manifest of manifests) {
      try {
        const action = await this.applyOne(manifest);
        applied.push({
          kind: manifest.kind,
          namespace: manifest.metadata.namespace,
          name: manifest.metadata.name,
          action,
        });
      } catch (error) {
        return {
          success: false,
          applied,
          errorMessage: this.describeError(manifest, error),
        };
      }
    }

    return { success: true, applied, errorMessage: null };
  }

  private async applyOne(
    manifest: K8sManifest,
  ): Promise<'created' | 'configured'> {
    const exists = await this.resourceExists(manifest);

    if (!exists) {
      await this.withTimeout(this.client.create<K8sManifest>(manifest));
      return 'created';
    }

    await this.withTimeout(
      this.client.patch<K8sManifest>(
        manifest,
        undefined,
        undefined,
        undefined,
        undefined,
        PatchStrategy.MergePatch,
      ),
    );
    return 'configured';
  }

  private async resourceExists(manifest: K8sManifest): Promise<boolean> {
    try {
      await this.withTimeout(
        this.client.read<K8sManifest>({
          apiVersion: manifest.apiVersion,
          kind: manifest.kind,
          metadata: {
            name: manifest.metadata.name,
            namespace: manifest.metadata.namespace,
          },
        }),
      );
      return true;
    } catch (error) {
      if (error instanceof ApiException && error.code === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * `KubernetesObjectApi`'s per-call methods don't expose a way to pass an
   * `AbortSignal`/timeout through their public signature (unlike the
   * lower-level `RequestContext.setSignal`, which isn't reachable from
   * here) — so the 30s bound is enforced by racing the call against a
   * rejecting timer instead of a library-native option.
   */
  private withTimeout<T>(promise: Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(
          new Error(
            `Kubernetes API call timed out after ${KubernetesConnector.APPLY_TIMEOUT_MS}ms`,
          ),
        );
      }, KubernetesConnector.APPLY_TIMEOUT_MS);

      promise.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error: unknown) => {
          clearTimeout(timer);
          reject(error instanceof Error ? error : new Error(String(error)));
        },
      );
    });
  }

  private describeError(manifest: K8sManifest, error: unknown): string {
    const target = `${manifest.kind}/${manifest.metadata.name} in ${manifest.metadata.namespace}`;
    const detail = error instanceof Error ? error.message : String(error);
    return `Failed to apply ${target}: ${detail}`;
  }
}
