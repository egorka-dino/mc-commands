#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
output_dir="${1:-$repo_root/.architecture-site}"
version=2026.09.19
checksum=ac1a2806e246364b88261a542a36ca7f3006ef48e5de68830afa8672f58690f1
cache_dir="${RUNNER_TEMP:-${TMPDIR:-/tmp}}/mc-commands-structurizr"
war="${STRUCTURIZR_WAR:-$cache_dir/structurizr-$version.war}"

if [[ ! -f "$war" ]]; then
    mkdir -p "$(dirname "$war")"
    curl --fail --location --retry 3 \
        "https://download.structurizr.com/structurizr-$version.war" -o "$war"
fi
printf '%s  %s\n' "$checksum" "$war" | shasum -a 256 --check

mkdir -p "$output_dir"
java -jar "$war" validate -workspace "$repo_root/docs/architecture/workspace.dsl"
java -jar "$war" export -workspace "$repo_root/docs/architecture/workspace.dsl" \
    -format static -output "$output_dir/diagrams"
source_ref="$(git -C "$repo_root" rev-parse HEAD)"
sed "s/__SOURCE_REF__/$source_ref/g" "$repo_root/tools/architecture/index.html" > "$output_dir/index.html"
touch "$output_dir/.nojekyll"
printf 'Architecture site: %s\n' "$output_dir"
