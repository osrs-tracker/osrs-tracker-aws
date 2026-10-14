#!/usr/bin/env bash
# Writes the live settings of OSRS Tracker's AWS resources to infra/aws-settings.json, so a `git diff` after an infra
# change (or after a while) shows what changed in the console. Read-only calls; needs the AWS CLI and jq. Runs as the
# `claude` profile unless AWS_PROFILE is set.
#
# The repo is public: the file holds names and settings only. Never ARNs, account or resource IDs, queue URLs, API IDs,
# subscription endpoints, or the values of env vars, stage variables and an integration's request parameters (where a
# header for the upstream, such as a credential, would live): only their names, taken with JMESPath inside the CLI. It
# is written only when no `arn:`, 12-digit number, AWS endpoint host, or API or integration ID it read made it into the
# output.
set -euo pipefail

export AWS_PROFILE=${AWS_PROFILE:-claude} AWS_REGION=eu-central-1 AWS_DEFAULT_REGION=eu-central-1 AWS_PAGER=''
out="$(dirname "$0")/aws-settings.json"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

aws() { command aws --output json "$@"; }

# A call whose resource has no such configuration (ResourceNotFoundException) prints null; any other error stops
optional() {
  if ! aws "$@" 2>"$tmp/err"; then
    grep -q ResourceNotFoundException "$tmp/err" && echo null && return
    cat "$tmp/err" >&2
    return 1
  fi
}

# Prepended to the jq filters that need them. `name`: the resource name in an ARN (`arn:aws:sqs:<region>:<account>:q`
# -> `q`, `…:function:f` -> `f`). `num`: SQS returns its attributes as strings
defs='def name: if type == "string" then sub("^arn:[^:]*:[^:]*:[^:]*:[0-9]*:"; "") | sub("^function:"; "") else . end;
def num: if type == "string" and test("^[0-9]+$") then tonumber else . end;
'

# Lambdas
aws logs describe-log-groups --log-group-name-prefix /aws/lambda/osrs-tracker_ \
  --query 'logGroups[].{name: logGroupName, days: retentionInDays}' >"$tmp/retention.json"
for fn in $(aws lambda list-functions --query "Functions[?starts_with(FunctionName, 'osrs-tracker_')].FunctionName" |
  jq -r '.[]'); do
  aws lambda get-function-configuration --function-name "$fn" --query '{
    runtime: Runtime, architectures: Architectures, handler: Handler, packageType: PackageType,
    timeoutSeconds: Timeout, memoryMB: MemorySize, ephemeralStorageMB: EphemeralStorage.Size,
    logGroup: LoggingConfig.LogGroup, logFormat: LoggingConfig.LogFormat, tracing: TracingConfig.Mode,
    envVarNames: keys(Environment.Variables || `{}`)}' >"$tmp/config.json"
  optional lambda get-function-event-invoke-config --function-name "$fn" --query '{
    retries: MaximumRetryAttempts, maxEventAgeSeconds: MaximumEventAgeInSeconds,
    onSuccess: DestinationConfig.OnSuccess.Destination, onFailure: DestinationConfig.OnFailure.Destination}' \
    >"$tmp/invoke.json"
  aws lambda get-function-concurrency --function-name "$fn" --query ReservedConcurrentExecutions >"$tmp/concurrency.json"
  aws lambda list-event-source-mappings --function-name "$fn" --query 'EventSourceMappings[].{
    source: EventSourceArn, state: State, batchSize: BatchSize, maxBatchingWindowSeconds: MaximumBatchingWindowInSeconds,
    maxConcurrency: ScalingConfig.MaximumConcurrency, functionResponseTypes: FunctionResponseTypes}' >"$tmp/sources.json"
  jq -n --arg fn "$fn" --slurpfile c "$tmp/config.json" --slurpfile i "$tmp/invoke.json" \
    --slurpfile rc "$tmp/concurrency.json" --slurpfile s "$tmp/sources.json" --slurpfile r "$tmp/retention.json" \
    "$defs"'$c[0] as $c | $i[0] as $i | {($fn): ($c + {
      envVarNames: ($c.envVarNames | sort),
      logRetentionDays: ([$r[0][] | select(.name == $c.logGroup) | .days] | first // "never expire"),
      reservedConcurrency: $rc[0],
      # without an event invoke config, Lambda retries an async invocation twice, for up to 6 hours
      asyncRetries: ($i.retries // "default (2)"),
      asyncMaxEventAgeSeconds: ($i.maxEventAgeSeconds // "default (21600)"),
      asyncOnSuccess: ($i.onSuccess | name), asyncOnFailure: ($i.onFailure | name),
      eventSourceMappings: ([$s[0][] | .source |= name] | sort_by(.source))
    } | del(.logGroup))}' >"$tmp/lambda-$fn.json"
done

# EventBridge schedules: the shared `Hourly` and `daily` rules and the `osrs-tracker_*` ones
for rule in $(aws events list-rules --query 'Rules[].Name' |
  jq -r '.[] | select(. == "Hourly" or . == "daily" or startswith("osrs-tracker"))'); do
  aws events describe-rule --name "$rule" --query '{schedule: ScheduleExpression, state: State, eventBus: EventBusName}' \
    >"$tmp/rule.json"
  aws events list-targets-by-rule --rule "$rule" --query 'Targets[].Arn' >"$tmp/targets.json"
  jq -n --arg rule "$rule" --slurpfile r "$tmp/rule.json" --slurpfile t "$tmp/targets.json" \
    "$defs"'{($rule): ($r[0] + {targets: ([$t[0][] | name] | sort)})}' >"$tmp/schedule-$rule.json"
done

# SQS queues
for url in $(aws sqs list-queues --queue-name-prefix osrs-tracker --query 'QueueUrls || `[]`' | jq -r '.[]'); do
  queue=${url##*/}
  aws sqs get-queue-attributes --queue-url "$url" --attribute-names VisibilityTimeout MessageRetentionPeriod \
    ReceiveMessageWaitTimeSeconds DelaySeconds MaximumMessageSize RedrivePolicy SqsManagedSseEnabled \
    --query Attributes >"$tmp/attributes.json"
  jq --arg q "$queue" "$defs"'{($q): {
    visibilityTimeoutSeconds: (.VisibilityTimeout | num), retentionSeconds: (.MessageRetentionPeriod | num),
    receiveWaitSeconds: (.ReceiveMessageWaitTimeSeconds | num), delaySeconds: (.DelaySeconds | num),
    maxMessageBytes: (.MaximumMessageSize | num), sseManaged: (.SqsManagedSseEnabled == "true"),
    redrive: (.RedrivePolicy | if . then fromjson | {deadLetterQueue: (.deadLetterTargetArn | name), maxReceiveCount}
      else null end)
  }}' "$tmp/attributes.json" >"$tmp/queue-$queue.json"
done

# Every HTTP API's ID and name. The IDs are what an alarm's `ApiId` dimension holds; they and the integrations' IDs
# (added below) go into ids.txt, which the final check refuses to find in the output
aws apigatewayv2 get-apis --query 'Items[].{id: ApiId, name: Name}' >"$tmp/apis.json"
jq -r '.[].id' "$tmp/apis.json" >"$tmp/ids.txt"

# CloudWatch alarms. An `ApiId` dimension is written as `Api` with the API's name
aws cloudwatch describe-alarms --alarm-name-prefix osrs-tracker --query MetricAlarms |
  jq --slurpfile apis "$tmp/apis.json" "$defs"'map({(.AlarmName): {
    description: .AlarmDescription, actionsEnabled: .ActionsEnabled,
    alarmActions: [.AlarmActions[] | name], okActions: [.OKActions[] | name],
    insufficientDataActions: [.InsufficientDataActions[] | name],
    namespace: .Namespace, metric: .MetricName,
    dimensions: (.Dimensions | map(if .Name == "ApiId" then .Value as $id
      | {Api: ([$apis[0][] | select(.id == $id) | .name] | first // "an API not in get-apis")}
      else {(.Name): .Value} end) | add),
    statistic: .Statistic, periodSeconds: .Period, evaluationPeriods: .EvaluationPeriods,
    datapointsToAlarm: .DatapointsToAlarm, threshold: .Threshold, comparison: .ComparisonOperator,
    treatMissingData: .TreatMissingData
  }}) | add // {}' >"$tmp/alarms.json"

# SNS topics: subscriptions counted per protocol, never their endpoints (an email address)
for topic in $(aws sns list-topics --query 'Topics[].TopicArn' |
  jq -r '.[] | select(split(":") | last | startswith("osrs-tracker"))'); do
  aws sns list-subscriptions-by-topic --topic-arn "$topic" \
    --query 'Subscriptions[].{protocol: Protocol, confirmed: SubscriptionArn != `PendingConfirmation`}' |
    jq --arg t "$topic" "$defs"'{($t | name): {subscriptions: (group_by(.protocol) | map({(.[0].protocol): {
      confirmed: (map(select(.confirmed)) | length), pending: (map(select(.confirmed | not)) | length)}}) | add // {})}}' \
      >"$tmp/topic-${topic##*:}.json"
done

# API Gateway HTTP APIs, OSRS Tracker's only (the hiscore proxy). Each route shows its integration, and each API the
# custom domains mapped to it; the integration and API IDs that link them are used here but not written
aws apigatewayv2 get-domain-names --query 'Items[].{domain: DomainName,
  endpointType: DomainNameConfigurations[0].EndpointType, securityPolicy: DomainNameConfigurations[0].SecurityPolicy}' \
  >"$tmp/domains.json"
echo '[]' >"$tmp/mappings.json"
for domain in $(jq -r '.[].domain' "$tmp/domains.json"); do
  aws apigatewayv2 get-api-mappings --domain-name "$domain" \
    --query "Items[].{apiId: ApiId, mappingKey: ApiMappingKey, stage: Stage, domain: '$domain'}" >"$tmp/mapping.json"
  jq -s 'add' "$tmp/mappings.json" "$tmp/mapping.json" >"$tmp/mappings.next.json"
  mv "$tmp/mappings.next.json" "$tmp/mappings.json"
done
for api in $(jq -r '.[].id' "$tmp/apis.json"); do
  aws apigatewayv2 get-api --api-id "$api" --query '{name: Name, description: Description, protocol: ProtocolType,
    disableExecuteApiEndpoint: DisableExecuteApiEndpoint, cors: CorsConfiguration}' >"$tmp/api.json"
  jq -e '.name | test("osrs.?tracker"; "i")' "$tmp/api.json" >/dev/null || continue
  aws apigatewayv2 get-routes --api-id "$api" --query 'Items[].{routeKey: RouteKey, authorization: AuthorizationType,
    apiKeyRequired: ApiKeyRequired, target: Target}' >"$tmp/routes.json"
  aws apigatewayv2 get-integrations --api-id "$api" --query 'Items[].{id: IntegrationId, type: IntegrationType,
    method: IntegrationMethod, uri: IntegrationUri, connectionType: ConnectionType,
    payloadFormatVersion: PayloadFormatVersion, timeoutMs: TimeoutInMillis, requestParameterNames: keys(RequestParameters || `{}`),
    responseParameters: ResponseParameters}' >"$tmp/integrations.json"
  jq -r '.[].id' "$tmp/integrations.json" >>"$tmp/ids.txt"
  aws apigatewayv2 get-stages --api-id "$api" --query 'Items[].{stage: StageName, autoDeploy: AutoDeploy,
    defaultRouteSettings: DefaultRouteSettings, routeSettings: RouteSettings,
    stageVariableNames: keys(StageVariables || `{}`)}' >"$tmp/stages.json"
  jq --arg id "$api" --slurpfile routes "$tmp/routes.json" --slurpfile ints "$tmp/integrations.json" \
    --slurpfile stages "$tmp/stages.json" --slurpfile domains "$tmp/domains.json" \
    --slurpfile mappings "$tmp/mappings.json" "$defs"'{(.name): (. + {
      routes: ([$routes[0][] | (.target // "" | sub("^integrations/"; "")) as $target | del(.target) + {
        integration: ([$ints[0][] | select(.id == $target) | del(.id) | .uri |= name] | first)}] | sort_by(.routeKey)),
      stages: ($stages[0] | sort_by(.stage)),
      domains: ([$mappings[0][] | select(.apiId == $id) | . as $m | ($domains[0][] | select(.domain == $m.domain))
        + {mappingKey: $m.mappingKey, stage: $m.stage}] | sort_by(.domain))
    })}' "$tmp/api.json" >"$tmp/api-$api.json"
done

# One object per section from its per-resource files ({} when there are none)
section() { if compgen -G "$tmp/$1-*.json" >/dev/null; then jq -s 'add' "$tmp/$1"-*.json; else echo '{}'; fi; }
jq -n -S --argjson lambdas "$(section lambda)" --argjson schedules "$(section schedule)" \
  --argjson queues "$(section queue)" --slurpfile alarms "$tmp/alarms.json" --argjson topics "$(section topic)" \
  --argjson apis "$(section api)" '{region: env.AWS_REGION, lambdas: $lambdas, schedules: $schedules, queues: $queues,
    alarms: $alarms[0], snsTopics: $topics, httpApis: $apis}' >"$tmp/out.json"

if grep -nE 'arn:|[0-9]{12}|amazonaws\.com|execute-api' "$tmp/out.json" >&2 ||
  { [ -s "$tmp/ids.txt" ] && grep -nF -f "$tmp/ids.txt" "$tmp/out.json" >&2; }; then
  echo "Not written: the lines above look like an ARN or ID, and this file is public" >&2
  exit 1
fi
mv "$tmp/out.json" "$out"
echo "Wrote $out"
