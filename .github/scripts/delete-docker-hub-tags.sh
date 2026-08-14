#!/usr/bin/env bash
# Deletes every tag listed in a newline-delimited file from a Docker
# Hub repository, via the Docker Hub Hub API. Stops at the first
# failed delete instead of continuing past it -- so a failure surfaces
# as a failed job right away, rather than silently leaving some tags
# undeleted with nobody noticing.
#
# Requires DOCKERHUB_USERNAME and HUB_API_TOKEN as environment
# variables. HUB_API_TOKEN is the JWT from the Hub API login call, not
# the DOCKERHUB_TOKEN repo secret directly.
#
# Usage: delete-docker-hub-tags.sh <repository-name> <tag-list-file>
set -euo pipefail

REPOSITORY="${1-}"
TAG_FILE="${2-}"

if [ -z "$REPOSITORY" ]; then
  echo "delete-docker-hub-tags: expected the repository name as the first argument" >&2
  exit 1
fi

if [ -z "$TAG_FILE" ] || [ ! -f "$TAG_FILE" ]; then
  echo "delete-docker-hub-tags: tag file not found: '$TAG_FILE'" >&2
  exit 1
fi

if [ -z "${DOCKERHUB_USERNAME-}" ] || [ -z "${HUB_API_TOKEN-}" ]; then
  echo "delete-docker-hub-tags: DOCKERHUB_USERNAME and HUB_API_TOKEN must both be set" >&2
  exit 1
fi

while IFS= read -r TAG; do
  [ -z "$TAG" ] && continue
  echo "Deleting tag: $TAG"
  curl -sf -X DELETE \
    -H "Authorization: JWT $HUB_API_TOKEN" \
    "https://hub.docker.com/v2/repositories/$DOCKERHUB_USERNAME/$REPOSITORY/tags/$TAG/"
done < "$TAG_FILE"
