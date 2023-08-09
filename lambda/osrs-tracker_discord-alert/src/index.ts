import { Handler } from 'aws-lambda';
import { Agent } from 'https';
import fetch from 'node-fetch';

const agent = new Agent({
  keepAlive: true,
  maxFreeSockets: 5,
  maxSockets: 5,
  timeout: 30000,
});

export const handler: Handler = async (event, context) => {
  if (!event.body) throw Error('No body');

  const body: { [key: string]: string } = JSON.parse(event.body!);

  const result = await fetch(process.env.WEBHOOK_URL!, {
    agent,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      embeds: [
        {
          title: body.title,
          description: body.description,
          color: Number(body.color),
          author: {
            name: body.authorName,
            url: body.authorUrl,
          },
          timestamp: body.timestamp,
        },
      ],
    }),
  });

  console.log(`Status: ${result.status} - ${result.statusText}`);

  return context.logStreamName;
};
