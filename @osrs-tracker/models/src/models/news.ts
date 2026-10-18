export interface OsrsNewsItem {
  title: string;
  pubDate: Date;
  category: string;
  link: string;
  description: string;
  enclosure: {
    url: string;
    type: string;
  };
}

/**
 * A post osrs-tracker-api stores, keyed on `link`: a feed item, or one backfilled once from the Wiki's `update` bucket
 * (2026-10-13). Backfilled posts got Jagex's teaser (`description`) and, where it's on `cdn.runescape.com`, image
 * (`enclosure`) from Jagex's news archive; the oldest have no image, and posts the archive doesn't list have neither.
 */
export type StoredNewsItem = Omit<OsrsNewsItem, 'description' | 'enclosure'> &
  Partial<Pick<OsrsNewsItem, 'description' | 'enclosure'>>;

/** A page of osrs-tracker-api's `GET /news/archive`: `next` is the `before` of the following page, `null` on the last one. */
export interface NewsArchivePage {
  posts: StoredNewsItem[];
  next: string | null;
}
