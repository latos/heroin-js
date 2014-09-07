#!/bin/bash

set -e

v=$1

if [ ! "$v" ]; then
  echo "usage: ./release.sh 0.0.1"
  exit 1
fi

git tag -a "v$v" -m "Release version $v"
git push origin master --tags
