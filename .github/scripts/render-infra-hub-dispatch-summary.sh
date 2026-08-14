#!/usr/bin/env bash
# Renders the "deploy dispatched to infra-hub" GITHUB_STEP_SUMMARY
# section for release-pcbox-api.yml. Prints Markdown to stdout -- appending
# it to $GITHUB_STEP_SUMMARY is the caller's job (in release-pcbox-api.yml),
# not this script's.
#
# Usage: render-infra-hub-dispatch-summary.sh <dockerhub-username> <image-tag> <repository-owner>
set -euo pipefail

DOCKERHUB_USERNAME="${1-}"
IMAGE_TAG="${2-}"
REPOSITORY_OWNER="${3-}"

if [ -z "$DOCKERHUB_USERNAME" ] || [ -z "$IMAGE_TAG" ] || [ -z "$REPOSITORY_OWNER" ]; then
  echo "render-infra-hub-dispatch-summary: expected <dockerhub-username> <image-tag> <repository-owner>" >&2
  exit 1
fi

echo "## 🚀 Deploy aprobado y disparado hacia infra-hub"
echo ""
echo "Este run pusheó \`$DOCKERHUB_USERNAME/pcbox-api:$IMAGE_TAG\` y, una vez aprobado arriba, le avisó a \`infra-hub\` que despliegue esa imagen en el cluster microk8s de pcbox. infra-hub la aplica automáticamente - no hace falta otra aprobación ahí."
echo ""
echo "**[▶ Ver el run de deploy en infra-hub](https://github.com/$REPOSITORY_OWNER/infra-hub/actions/workflows/deploy-pcbox-api.yml)**"
