export class LatestPrice {
  high: number;
  /** Unix timestamp. */
  highTime: number;

  low: number;
  /** Unix timestamp. */
  lowTime: number;
}

export class Item {
  id: number;

  name: string;
  examine: string;
  icon: string;

  members: true;

  value: number;
  limit: number;

  lowalch: number;
  highalch: number;

  latest: LatestPrice;
}
