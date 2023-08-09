export interface DiscordAlert {
  title?: string;
  description?: string;
  /** In hex format, ex. 0x00ff00. */
  color?: Number;
  authorName?: string;
  /** Including https:// */
  authorUrl?: string;
  timestamp?: Date;
}
