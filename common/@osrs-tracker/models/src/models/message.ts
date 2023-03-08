import { ItemPage } from './item';

export class PlayerScrapeMessageBody {
  usernames: string[];
  scrapingOffset: number;
}

export type ItemScrapeMessageBody = ItemPage[];
