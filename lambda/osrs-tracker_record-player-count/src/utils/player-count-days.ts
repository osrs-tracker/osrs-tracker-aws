import { Document } from 'mongodb';

/**
 * The `playerCounts` pipeline that averages the samples from `from` on (every sample without it) per UTC day, into one
 * `PlayerCountDay` per day that has samples. The grouping and rounding are osrs-tracker-api's daily history
 * (`api:src/features/player-counts/player-count-history.ts`, `buildPlayerCountHistoryPipeline`), so its `1y` and `all`
 * answer the same when it reads these days instead.
 */
export function playerCountDaysPipeline(from?: Date): Document[] {
  // Each sample is one document per location code after the `$unwind`: its own fields count once, on its first code.
  const first = { $eq: ['$i', 0] };
  const once = (value: string | number) => ({ $sum: { $cond: [first, value, 0] } });
  const average = (sum: string) => ({ $round: [{ $divide: [sum, '$samples'] }, 0] });

  return [
    ...(from ? [{ $match: { date: { $gte: from } } }] : []),
    {
      $project: {
        date: { $dateTrunc: { date: '$date', unit: 'day' } },
        total: 1,
        members: 1,
        f2p: 1,
        location: { $objectToArray: '$byLocation' },
      },
    },
    { $unwind: { path: '$location', includeArrayIndex: 'i' } },
    {
      $group: {
        _id: { date: '$date', code: '$location.k' },
        players: { $avg: '$location.v' },
        samples: once(1),
        total: once('$total'),
        members: once('$members'),
        f2p: once('$f2p'),
        peak: { $max: '$total' },
      },
    },
    {
      $group: {
        _id: '$_id.date',
        samples: { $sum: '$samples' },
        total: { $sum: '$total' },
        members: { $sum: '$members' },
        f2p: { $sum: '$f2p' },
        peak: { $max: '$peak' },
        byLocation: { $push: { k: '$_id.code', v: { $round: ['$players', 0] } } },
      },
    },
    {
      $project: {
        _id: 0,
        date: '$_id',
        total: average('$total'),
        members: average('$members'),
        f2p: average('$f2p'),
        byLocation: { $arrayToObject: '$byLocation' },
        // computed, not included (`1`), so the stored fields keep this order
        peak: '$peak',
        samples: '$samples',
      },
    },
  ];
}
