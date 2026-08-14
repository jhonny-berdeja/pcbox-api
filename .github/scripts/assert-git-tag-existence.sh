#!/usr/bin/env bash
# Asserts a git tag's existence matches the expected mode, and fails
# with a clear message if it doesn't. Thin wrapper around
# git-tag-exists.sh so the assertion and its error message don't have
# to live inline in the workflow YAML.
#
# Usage: assert-git-tag-existence.sh <exists|not-exists> <tag>
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

MODE="${1-}"
TAG="${2-}"

if [ "$MODE" != "exists" ] && [ "$MODE" != "not-exists" ]; then
  echo "assert-git-tag-existence: first argument must be 'exists' or 'not-exists'" >&2
  exit 1
fi

if [ -z "$TAG" ]; then
  echo "assert-git-tag-existence: expected the tag as the second argument" >&2
  exit 1
fi

if "$SCRIPT_DIR/git-tag-exists.sh" "$TAG"; then
  TAG_EXISTS=1
else
  TAG_EXISTS=0
fi

if [ "$MODE" = "exists" ] && [ "$TAG_EXISTS" -eq 0 ]; then
  echo "The tag '$TAG' does not exist as a git tag." >&2
  exit 1
fi

if [ "$MODE" = "not-exists" ] && [ "$TAG_EXISTS" -eq 1 ]; then
  echo "The tag '$TAG' already exists as a git tag." >&2
  exit 1
fi

exit 0
