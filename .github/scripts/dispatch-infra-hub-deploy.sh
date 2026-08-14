#!/usr/bin/env bash
# Triggers infra-hub's deploy-pcbox-api.yml workflow via the gh
# CLI, passing the given image tag as its `image_tag` input. Requires
# GH_TOKEN as an environment variable, scoped to actions:write on
# infra-hub (see ci-cd-conventions.md for why that scope, not more).
#
# Usage: dispatch-infra-hub-deploy.sh <repository-owner> <image-tag>
set -euo pipefail

REPOSITORY_OWNER="${1-}"
IMAGE_TAG="${2-}"

if [ -z "$REPOSITORY_OWNER" ] || [ -z "$IMAGE_TAG" ]; then
  echo "dispatch-infra-hub-deploy: expected <repository-owner> <image-tag>" >&2
  exit 1
fi

gh workflow run deploy-pcbox-api.yml \
  --repo "$REPOSITORY_OWNER/infra-hub" \
  --ref master \
  -f image_tag="$IMAGE_TAG"
