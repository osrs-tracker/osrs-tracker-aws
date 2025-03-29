export interface Item {
  id: number;

  name: string;
  examine: string;
  icon: string;

  members: true;

  value: number;
  limit: number;

  lowalch: number;
  highalch: number;

  /** Last time the detail was fetched for this item. */
  lastFetch?: Date;
}
