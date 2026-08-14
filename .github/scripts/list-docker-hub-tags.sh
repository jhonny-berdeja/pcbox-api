#!/usr/bin/env bash
# Lists every tag in a Docker Hub repository via the Docker Hub Hub API
# (hub.docker.com/v2), following pagination through the response's
# `next` field. Prints one tag name per line to stdout.
#
# Unlike the other scripts in this folder, this one is not run under
# GitHub Actions' implicit `bash -e -o pipefail` wrapper (that wrapper
# only applies to inline `run:` blocks, not to an external script file
# invoked from one) -- so it declares the same flags itself, to fail
# fast the same way the original inline loop did.
#
# Requires DOCKERHUB_USERNAME and HUB_API_TOKEN as environment
# variables. HUB_API_TOKEN is the JWT from the Hub API login call, not
# the DOCKERHUB_TOKEN repo secret directly.
#
# Usage: list-docker-hub-tags.sh <repository-name>
set -euo pipefail

REPOSITORY="${1-}"

if [ -z "$REPOSITORY" ]; then
  echo "list-docker-hub-tags: expected exactly one argument (the repository name)" >&2
  exit 1
fi

if [ -z "${DOCKERHUB_USERNAME-}" ] || [ -z "${HUB_API_TOKEN-}" ]; then
  echo "list-docker-hub-tags: DOCKERHUB_USERNAME and HUB_API_TOKEN must both be set" >&2
  exit 1
fi

PAGE_URL="https://hub.docker.com/v2/repositories/$DOCKERHUB_USERNAME/$REPOSITORY/tags/?page_size=100"

while [ -n "$PAGE_URL" ] && [ "$PAGE_URL" != "null" ]; do
  PAGE_RESPONSE="$(curl -sf -H "Authorization: JWT $HUB_API_TOKEN" "$PAGE_URL")"
  echo "$PAGE_RESPONSE" | jq -r '.results[].name'
  PAGE_URL="$(echo "$PAGE_RESPONSE" | jq -r '.next')"
done
