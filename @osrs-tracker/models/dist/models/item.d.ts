export declare enum Trend {
    Negative = "negative",
    Neutral = "neutral",
    Positive = "positive"
}
export declare class Price {
    price: string;
    trend: Trend;
}
export declare class ItemPage {
    letter: string;
    page: number;
}
export declare class Item {
    id: number;
    name: string;
    description: string;
    members: boolean;
    current: Price;
    today: Price;
    icon: string;
    icon_large: string;
}
