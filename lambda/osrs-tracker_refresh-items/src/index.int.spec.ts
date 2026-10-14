import { Item } from '@osrs-tracker/models';
import { Context, ScheduledEvent } from 'aws-lambda';
import { Collection, MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_REMOVED_ITEMS, MU } from './utils/mongo.utils';

/** Production runs MongoDB 8.0 (Atlas), as in @osrs-tracker/models' integration tests. */
const MONGODB_VERSION = '8.0.12';

const event = {} as ScheduledEvent;
const context = { logStreamName: 'test-stream' } as Context;

const item = (id: number, name = `Item ${id}`): Item => ({
  id,
  name,
  examine: 'An item.',
  icon: `${name}.png`,
  members: true,
  value: 1,
  limit: 100,
  lowalch: 1,
  highalch: 1,
});

/** Items `from` to `to`, both included. */
const itemRange = (from: number, to: number): Item[] => Array.from({ length: to - from + 1 }, (_, i) => item(from + i));

describe('refresh-items handler (MongoDB)', () => {
  let server: MongoMemoryServer;
  let client: MongoClient;
  let items: Collection;
  let handler: typeof import('./index').handler;

  const wikiResponds = (response: Response) => vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);
  const storedIds = async () => (await items.find().sort({ id: 1 }).toArray()).map(({ id }) => id);

  beforeAll(async () => {
    server = await MongoMemoryServer.create({ binary: { version: MONGODB_VERSION } });
    client = await MongoClient.connect(server.getUri());
    items = MU.col(client);
    // the API creates it; the handler's queries hint it
    await items.createIndex({ id: 1 }, { unique: true });

    // the handler creates its client when it's imported: hand it this one
    vi.spyOn(MU, 'client').mockReturnValue(client);
    ({ handler } = await import('./index'));
  }, 120_000);

  afterAll(async () => {
    await client?.close();
    await server?.stop();
  });

  beforeEach(async () => {
    await items.deleteMany({});
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  it("upserts the Wiki's items and returns the log stream name", async () => {
    await items.insertOne(item(1, 'Old name'));
    wikiResponds(Response.json([item(1, 'New name'), item(2)]));

    await expect(handler(event, context)).resolves.toBe('test-stream');

    expect(await items.find({}, { projection: { _id: 0 } }).toArray()).toEqual([item(1, 'New name'), item(2)]);
  });

  it('throws on an empty item list and deletes nothing', async () => {
    await items.insertMany(itemRange(1, 3));
    wikiResponds(Response.json([]));

    // the driver rejects the empty bulk write ("Batch cannot be empty") before the handler's own `No items processed`
    await expect(handler(event, context)).rejects.toThrow();

    expect(await storedIds()).toEqual([1, 2, 3]);
  });

  it('throws with the HTTP status on a non-2xx response and changes nothing', async () => {
    await items.insertMany(itemRange(1, 3));
    wikiResponds(new Response('Bad Gateway', { status: 502 }));

    await expect(handler(event, context)).rejects.toThrow('Item mapping request failed: HTTP 502');

    expect(await storedIds()).toEqual([1, 2, 3]);
  });

  it(`removes the items missing from the Wiki's list when there are ${MAX_REMOVED_ITEMS}`, async () => {
    await items.insertMany(itemRange(1, MAX_REMOVED_ITEMS + 1));
    wikiResponds(Response.json([item(1)]));

    await handler(event, context);

    expect(await storedIds()).toEqual([1]);
  });

  it(`skips the delete when more than ${MAX_REMOVED_ITEMS} items are missing from the Wiki's list`, async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await items.insertMany(itemRange(1, MAX_REMOVED_ITEMS + 2));
    wikiResponds(Response.json([item(1)]));

    await handler(event, context);

    expect(await items.countDocuments()).toBe(MAX_REMOVED_ITEMS + 2);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(`Skipped removing ${MAX_REMOVED_ITEMS + 1} items`));
  });
});
