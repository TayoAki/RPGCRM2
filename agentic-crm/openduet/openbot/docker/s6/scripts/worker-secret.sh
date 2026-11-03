#!/bin/sh
# The secret the routine worker presents to the API beside it. Generated like COMPUTER_TOKEN; set
# WORKER_SHARED_SECRET yourself and this leaves it be.
set -eu
if [ -z "${WORKER_SHARED_SECRET:-}" ]; then
  head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n' \
    > /run/s6/container_environment/WORKER_SHARED_SECRET
fi

chmod 0700 /run/s6/container_environment
