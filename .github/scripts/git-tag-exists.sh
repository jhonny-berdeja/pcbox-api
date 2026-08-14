#!/usr/bin/env bash
# Checks whether a given git tag exists in the current repository
# checkout. Exit 0 if it exists, exit 1 if it does not.
#
# Requires the checkout to have fetched tags (actions/checkout with
# fetch-tags: true) -- a shallow checkout without tags will always
# report "does not exist", even for a tag that's on the remote.
#
# Usage: git-tag-exists.sh <tag>
set -euo pipefail

TAG="${1-}"

if [ -z "$TAG" ]; then
  echo "git-tag-exists: expected the tag as the first argument" >&2
  exit 1
fi

git rev-parse --verify --quiet "refs/tags/$TAG" > /dev/null
