#!/usr/bin/env bash
# Creates a lightweight git tag at the current HEAD and pushes it to
# origin. Lightweight (no `-a`/`-m`), so no tagger identity needs to be
# configured -- only annotated tags require one.
#
# Usage: create-git-tag.sh <tag>
set -euo pipefail

TAG="${1-}"

if [ -z "$TAG" ]; then
  echo "create-git-tag: expected the tag as the first argument" >&2
  exit 1
fi

git tag "$TAG"
git push origin "$TAG"
