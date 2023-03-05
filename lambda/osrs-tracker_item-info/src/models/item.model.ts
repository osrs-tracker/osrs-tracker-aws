export enum Trend {
  Negative = 'negative',
  Neutral = 'neutral',
  Positive = 'positive',
}

export class Price {
  price: string;
  trend: Trend;
}

export class Item {
  id: number;
  name: string;
  description: string;
  members: boolean;

  current: Price;
  today: Price;

  icon: string;
  icon_large: string;
}
