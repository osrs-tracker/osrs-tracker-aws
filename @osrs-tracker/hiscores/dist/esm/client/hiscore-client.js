const DEFAULT_TIMEOUT_MS = 10_000;
export async function getHiscore({ baseUrl, username, table = 'hiscore_oldschool', fetch: fetchFn = fetch, timeoutMs = DEFAULT_TIMEOUT_MS, }) {
    const url = `${baseUrl}/m=${table}/index_lite.json?player=${encodeURIComponent(username)}`;
    try {
        const response = await fetchFn(url, {
            headers: { 'cache-control': 'no-cache' },
            signal: AbortSignal.timeout(timeoutMs),
        });
        if (response.status === 404 || response.status === 400)
            return { status: 'notFound', httpStatus: response.status };
        if (!response.ok)
            return { status: 'failed', reason: `HTTP ${response.status}` };
        const hiscore = (await response.json().catch(() => null));
        if (!Array.isArray(hiscore?.skills) || !Array.isArray(hiscore?.activities))
            return { status: 'failed', reason: 'unexpected body' };
        return { status: 'found', hiscore: hiscore };
    }
    catch (error) {
        const { name, message } = (error ?? {});
        if (name === 'TimeoutError' || name === 'AbortError')
            return { status: 'failed', reason: `timed out after ${timeoutMs}ms` };
        return { status: 'failed', reason: `network error: ${typeof message === 'string' ? message : String(error)}` };
    }
}
