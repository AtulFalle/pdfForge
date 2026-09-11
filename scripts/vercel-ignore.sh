#!/usr/bin/env bash
set -eu

# Vercel ignored-build-step: exit 0 skips the build, exit 1 continues it.
# Production deploys on the production branch (master). Previews deploy for PRs only.
if [ "${VERCEL_ENV:-}" = "production" ]; then
  exit 1
fi

if [ -n "${VERCEL_GIT_PULL_REQUEST_ID:-}" ]; then
  exit 1
fi

echo "Skipping Vercel build (not production and not a pull request)."
exit 0
