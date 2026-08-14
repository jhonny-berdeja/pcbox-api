#!/usr/bin/env bash
# Asserts a Docker Hub tag's existence matches the expected mode, and
# fails with a clear message if it doesn't. Thin wrapper around
# docker-hub-tag-exists.sh so the assertion and its error message
# don't have to live inline in the workflow YAML.
#
# Requires DOCKERHUB_USERNAME and HUB_API_TOKEN as environment
# variables (same as docker-hub-tag-exists.sh).
#
# Usage: assert-docker-hub-tag-existence.sh <exists|not-exists> <repository-name> <tag>
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

MODE="${1-}"
REPOSITORY="${2-}"
TAG="${3-}"

if [ "$MODE" != "exists" ] && [ "$MODE" != "not-exists" ]; then
  echo "assert-docker-hub-tag-existence: first argument must be 'exists' or 'not-exists'" >&2
  exit 1
fi

if [ -z "$REPOSITORY" ] || [ -z "$TAG" ]; then
  echo "assert-docker-hub-tag-existence: expected <repository-name> <tag>" >&2
  exit 1
fi

if "$SCRIPT_DIR/docker-hub-tag-exists.sh" "$REPOSITORY" "$TAG"; then
  TAG_EXISTS=1
else
  TAG_EXISTS=0
fi

if [ "$MODE" = "exists" ] && [ "$TAG_EXISTS" -eq 0 ]; then
  echo "The tag '$TAG' does not exist in the $REPOSITORY Docker Hub repository." >&2
  exit 1
fi

if [ "$MODE" = "not-exists" ] && [ "$TAG_EXISTS" -eq 1 ]; then
  echo "The tag '$TAG' already exists in the $REPOSITORY Docker Hub repository." >&2
  exit 1
fi

exit 0
