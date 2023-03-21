export declare class LatestPrice {
    high: number;
    highTime: number;
    low: number;
    lowTime: number;
}
export declare class Item {
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
