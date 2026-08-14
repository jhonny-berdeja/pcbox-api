#!/usr/bin/env bash
# Checks whether a given tag exists in a Docker Hub repository via the
# Docker Hub Hub API. Exit 0 if it exists, exit 1 if it does not (or on
# a usage/auth error).
#
# Deliberately does NOT use curl's `-f` flag (unlike every other curl
# call in this codebase): with `-f`, curl would treat the 404 response
# for a genuinely-missing tag as a curl error and abort under `set -e`
# before reaching the status check below, breaking the "exit 1 = does
# not exist" contract this script promises its callers.
#
# Requires DOCKERHUB_USERNAME and HUB_API_TOKEN as environment
# variables. HUB_API_TOKEN is the JWT from the Hub API login call, not
# the DOCKERHUB_TOKEN repo secret directly.
#
# Usage: docker-hub-tag-exists.sh <repository-name> <tag>
set -euo pipefail

REPOSITORY="${1-}"
TAG="${2-}"

if [ -z "$REPOSITORY" ] || [ -z "$TAG" ]; then
  echo "docker-hub-tag-exists: expected <repository-name> <tag>" >&2
  exit 1
fi

if [ -z "${DOCKERHUB_USERNAME-}" ] || [ -z "${HUB_API_TOKEN-}" ]; then
  echo "docker-hub-tag-exists: DOCKERHUB_USERNAME and HUB_API_TOKEN must both be set" >&2
  exit 1
fi

HTTP_STATUS="$(curl -s -o /dev/null -w '%{http_code}' \
  -H "Authorization: JWT $HUB_API_TOKEN" \
  "https://hub.docker.com/v2/repositories/$DOCKERHUB_USERNAME/$REPOSITORY/tags/$TAG/")"

[ "$HTTP_STATUS" = "200" ]
