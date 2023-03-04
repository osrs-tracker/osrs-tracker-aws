export class ItemPage {
  letter: string;
  page: number;
}

export enum Trend {
  Negative = 'negative',
  Neutral = 'neutral',
  Positive = 'positive',
}

export class Price {
  price: string;
  trend: Trend;
}

export class ItemResponse {
  id: number;
  name: string;
  description: string;
  members: boolean;

  current: Price;
  today: Price;

  icon: string;
  icon_large: string;

  // optional section so we can exclude them from the bulk write
  type?: string;
  typeIcon?: string;
}
