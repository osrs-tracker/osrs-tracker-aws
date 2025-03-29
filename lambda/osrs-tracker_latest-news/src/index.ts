import { OsrsNewsItem } from '@osrs-tracker/models';
import { APIGatewayEvent, APIGatewayProxyResultV2 } from 'aws-lambda';
import { XMLParser } from 'fast-xml-parser';
import { Agent } from 'https';
import fetch from 'node-fetch';

const agent = new Agent({
  keepAlive: true,
  maxFreeSockets: 5,
  maxSockets: 5,
  timeout: 30000,
});

const xml = new XMLParser({
  attributeNamePrefix: '',
  textNodeName: '$text',
  ignoreAttributes: false,
});

export const handler = async (event: APIGatewayEvent): Promise<APIGatewayProxyResultV2> => {
  const rss = await fetch(process.env.OSRS_API_BASE_URL + '/m=news/latest_news.rss?oldschool=true', { agent }).then(
    (res) => res.text(),
  );

  const parsedRss = xml.parse(rss);

  const osrsNewsItems = parsedRss.rss.channel.item.map(
    (val: any) =>
      ({
        title: val.title,
        pubDate: new Date(val.pubDate),
        category: val.category,
        link: val.link,
        description: val.description,
        enclosure: {
          url: val.enclosure.url,
          type: val.enclosure.type,
        },
      }) as OsrsNewsItem,
  );

  return {
    statusCode: 200,
    headers: {
      'Cache-Control': 'max-age=43200', // 12 hours
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(osrsNewsItems.slice(0, 4)), // Only return the first 4 items
  };
};
