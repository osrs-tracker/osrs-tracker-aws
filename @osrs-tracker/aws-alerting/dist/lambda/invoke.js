import { Lambda } from '@aws-sdk/client-lambda';
export function discordAlert(data) {
    return new Lambda().invoke({
        FunctionName: 'osrs-tracker_discord-alert',
        InvocationType: 'RequestResponse',
        Payload: JSON.stringify({
            body: JSON.stringify({
                ...data,
                timestamp: data.timestamp?.toISOString(),
            }),
        }),
    });
}
