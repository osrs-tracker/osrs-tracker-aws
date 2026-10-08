import { HiscoreActivity, HiscoreSkill } from '@osrs-tracker/models';
export type HiscoreTable = 'hiscore_oldschool' | 'hiscore_oldschool_ironman' | 'hiscore_oldschool_ultimate' | 'hiscore_oldschool_hardcore_ironman';
export type HiscoreJson = {
    name: string;
    skills: HiscoreSkill[];
    activities: HiscoreActivity[];
};
export type HiscoreResult = {
    status: 'found';
    hiscore: HiscoreJson;
} | {
    status: 'notFound';
    httpStatus: 400 | 404;
} | {
    status: 'failed';
    reason: string;
};
export type HiscoreFetch = (url: string, init: {
    headers: Record<string, string>;
    signal: AbortSignal;
}) => Promise<{
    status: number;
    ok: boolean;
    json(): Promise<unknown>;
}>;
export type GetHiscoreOptions = {
    baseUrl: string;
    username: string;
    table?: HiscoreTable;
    fetch?: HiscoreFetch;
    timeoutMs?: number;
};
export declare function getHiscore({ baseUrl, username, table, fetch: fetchFn, timeoutMs, }: GetHiscoreOptions): Promise<HiscoreResult>;
