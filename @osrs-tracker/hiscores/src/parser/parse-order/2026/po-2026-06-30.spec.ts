import { describe, expect, it } from '@jest/globals';
import { BossEnum } from '../../../models/hiscore.enum';
import { parseHiscoreString } from '../../parser';

describe('Parser with 2026-06-30 parse order', () => {
  it('should parse with Maggot King', () => {
    const hiscoreString =
      '164795,2238,286631362\n186305,99,16694677\n115879,99,17510834\n95052,99,38002502\n161325,99,37299409\n234859,99,26352749\n265498,93,7204100\n295270,99,16022948\n497498,97,10748435\n342227,94,8066818\n488174,90,5598994\n566635,84,3187121\n490912,95,8772706\n280714,95,8851211\n235008,90,5613679\n295078,93,7295204\n211004,94,7956477\n336546,85,3312145\n342439,91,5907871\n139269,99,15149774\n379066,98,12721973\n346986,82,2422399\n551219,80,2147819\n317110,85,3446194\n9153,99,16345323\n-1,0\n-1,0\n-1,0\n-1,0\n-1,0\n-1,0\n-1,0\n189847,414\n358433,19\n124147,82\n172291,117\n185432,156\n168565,35\n290918,5\n228653,603\n-1,2500\n-1,0\n232670,205\n251504,546\n66244,626\n139557,320\n156562,470\n31753,136\n25604,1416\n-1,3\n219891,314\n187310,200\n425308,5\n61110,356\n54807,313\n245919,249\n332447,10\n-1,0\n-1,1\n332313,13\n75957,305\n-1,0\n144666,60\n200010,152\n434602,90\n217635,128\n216047,25\n-1,0\n-1,1\n186829,232\n180868,203\n233273,86\n137509,85\n85121,236\n621624,25\n407994,557\n-1,1\n12834,817\n51614,307\n227521,1\n-1,0\n-1,0\n-1,0\n-1,0\n460671,5\n-1,0\n60784,382\n-1,1\n73169,216\n57269,172\n235990,28\n-1,0\n128622,35\n324379,100\n-1,2\n20782,916\n3198,832\n-1,4\n204977,119\n-1,1\n-1,0\n-1,0\n87989,896\n255863,17\n-1,0\n-1,0\n-1,1\n135894,52\n267546,7\n-1,0\n276107,330\n412698,352\n-1,0\n84239,198\n299066,312';

    const hiscore = parseHiscoreString(hiscoreString, new Date(2026, 5, 30, 12));

    expect(hiscore.bosses[BossEnum.LunarChests]).toEqual({
      name: BossEnum.LunarChests,
      rank: 51614,
      score: 307,
    });
    expect(hiscore.bosses[BossEnum.Mimic]).toEqual({
      name: BossEnum.Mimic,
      rank: 227521,
      score: 1,
    });
    expect(hiscore.bosses[BossEnum.MaggotKing]).toEqual({
      name: BossEnum.MaggotKing,
      rank: -1,
      score: 0,
    });
    expect(hiscore.bosses[BossEnum.Nex]).toEqual({
      name: BossEnum.Nex,
      rank: -1,
      score: 0,
    });
  });
});
