#!/usr/bin/env bash
# Runs the verify checks for the Lambdas and packages a change touches, plus the root Prettier check, all at once (none
# waits for or stops at another's failure). Then prints each failed check's log and a summary line per check. Exits 1
# when any check failed. Run from the checkout's root.
#
#   verify.sh                 checks what `git diff --cached` touches (before a commit)
#   verify.sh --all-changes   adds unstaged changes (verifying without a commit)
set -u
# Plain output: the logs are read by Claude, not a terminal
export NO_COLOR=1 FORCE_COLOR=0

# Every Lambda folder; lambda/shared is code they bundle, not a Lambda
lambdas=()
for dir in lambda/*/; do
  dir=${dir%/}
  [ -f "$dir/package.json" ] && [ "$dir" != lambda/shared ] && lambdas+=("${dir#lambda/}")
done

changed=$(git diff --cached --name-only)
if [ "${1:-}" = --all-changes ]; then
  changed+=$'\n'$(git diff --name-only)
fi

# Each check: a name, the folder it runs in and its command
names=() dirs=() commands=()
add() { names+=("$1") dirs+=("$2") commands+=("$3"); }

add prettier . 'npm run prettier:ci'
folders=(.)

lambda_checked=
for lambda in "${lambdas[@]}"; do
  # every Lambda bundles lambda/shared, extends lambda/tsconfig.lambda.json and installs from the lambda/ workspace, as
  # in CI
  if grep -qE "^lambda/(($lambda|shared)/|tsconfig\.lambda\.json$|package(-lock)?\.json$)" <<<"$changed"; then
    dir=lambda/$lambda
    lambda_checked=1
    add "$lambda prettier" "$dir" 'npm run prettier:ci'
    add "$lambda lint" "$dir" 'npm run lint'
    # esbuild doesn't type-check; this also checks the shared files the Lambda imports
    add "$lambda types" "$dir" 'npx tsc --noEmit -p .'
    add "$lambda build" "$dir" 'npm run build'
    compgen -G "$dir/vitest.config.*" > /dev/null && add "$lambda test" "$dir" 'npx vitest run'
  fi
done

# The Lambdas are one npm workspace: one install in lambda/ for all of them
[ -n "$lambda_checked" ] && folders+=(lambda)

# Every package's ESLint config re-exports the Lambdas' one, as in CI
packages=$(grep -oE '^@osrs-tracker/[^/]+/' <<<"$changed")
if grep -qx 'lambda/shared/eslint\.config\.mjs' <<<"$changed"; then
  packages+=$'\n'$(printf '%s\n' @osrs-tracker/*/)
fi

# One build+test job per package: the tests use what the build checks first. Never `npm test`: it's watch mode.
for package in $(sort -u <<<"$packages"); do
  dir=${package%/}
  case $dir in
    */hiscores | */models) command='npm run build && npx tsc -p tsconfig.spec.json && npx vitest run' ;;
    *) command='npm run build && npx vitest run' ;;
  esac
  folders+=("$dir")
  add "${dir#@osrs-tracker/} lint" "$dir" 'npm run lint'
  add "${dir#@osrs-tracker/} build+test" "$dir" "$command"
done

# A worktree has no node_modules of its own. One at a time: parallel installs compete for the npm cache.
for dir in "${folders[@]}"; do
  if [ ! -d "$dir/node_modules" ]; then
    echo "npm ci in $dir"
    (cd "$dir" && npm ci --no-audit --no-fund >/dev/null 2>&1) || { echo "npm ci failed in $dir"; exit 1; }
  fi
done

out=$(mktemp -d)
for i in "${!names[@]}"; do
  (
    start=$SECONDS
    cd "${dirs[$i]}" && bash -c "${commands[$i]}" >"$out/$i.log" 2>&1
    echo "$? $((SECONDS - start))" >"$out/$i.status"
  ) &
done
wait

summary=()
failed=0
for i in "${!names[@]}"; do
  read -r code secs <"$out/$i.status"
  line="${names[$i]} (${secs}s): ${dirs[$i]}: ${commands[$i]}"
  if [ "$code" -eq 0 ]; then
    summary+=("passed  $line")
  else
    failed=1
    summary+=("FAILED  $line")
    echo "=== ${names[$i]} failed: ${dirs[$i]}: ${commands[$i]}"
    if [ "$(wc -l <"$out/$i.log")" -gt 60 ]; then
      echo "(last 60 lines; full log: $out/$i.log)"
      tail -n 60 "$out/$i.log"
    else
      cat "$out/$i.log"
    fi
    echo
  fi
done

echo '=== Summary'
printf '%s\n' "${summary[@]}"
# Keep the logs a failure points to
[ "$failed" -eq 0 ] && rm -rf "$out"
exit "$failed"
