#!/usr/bin/env bash
# Validates a Docker Hub image tag before it is interpolated into curl
# calls (Docker Hub Hub API login/list/delete) inside a workflow `run:`
# block. Fail-closed: any input that does not match the allowed
# character set and length is rejected. Mirrors
# infra-hub/scripts/validate-image-tag.sh's validation rule exactly, so
# the two repos' tag-handling scripts stay consistent.
#
# Usage: validate-image-tag.sh <tag>
# Exit 0: tag is safe to use. Exit 1: tag rejected (or missing argument).
set -u

TAG="${1-}"

# Exactly one argument, non-empty, 1-128 chars, only
# [a-zA-Z0-9._-] -- matches Docker tag-safe characters and excludes every
# shell metacharacter, path separator, and whitespace.
if [ "$#" -ne 1 ]; then
  echo "validate-image-tag: expected exactly one argument (the image tag)" >&2
  exit 1
fi

if [[ ! "$TAG" =~ ^[a-zA-Z0-9._-]{1,128}$ ]]; then
  echo "validate-image-tag: rejected tag (invalid characters, empty, or over 128 chars)" >&2
  exit 1
fi

# Reject a leading dash even though the character class already allows
# '-': a leading dash could be misread as a flag by a downstream command
# that receives this value unquoted.
if [[ "$TAG" == -* ]]; then
  echo "validate-image-tag: rejected tag (leading dash)" >&2
  exit 1
fi

exit 0
