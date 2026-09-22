import { describe, expect, it } from '@jest/globals';
import { ActivityEnum } from '../../../models/hiscore.enum';
import { parseHiscoreString } from '../../parser';

describe('Parser with 2026-07-29 parse order', () => {
  it('should parse with Mad Angel/Wyrmscraig', () => {
    const hiscoreString =
      '166782,2240,299869096\n178695,99,17057141\n111008,99,17837403\n87374,99,41045855\n145082,99,40082411\n199096,99,30093321\n266873,93,7232049\n268852,99,16867376\n501421,97,10768042\n340540,94,8388472\n480969,90,5793420\n564951,85,3258774\n495444,95,8773056\n282858,95,8866656\n237719,90,5614138\n299860,93,7295370\n209495,94,8109250\n314738,85,3498483\n346190,91,5907871\n131344,99,15585808\n274185,99,13401087\n350946,82,2424659\n552959,80,2173269\n320868,85,3449278\n9785,99,16345907\n-1,0\n-1,0\n-1,0\n-1,0\n-1,0\n-1,0\n-1,0\n192174,414\n362894,19\n125718,82\n174072,117\n187079,156\n170372,35\n292836,5\n229508,603\n-1,2500\n-1,0\n237009,205\n256663,546\n64613,637\n142713,320\n158450,470\n32656,136\n26477,1416\n-1,3\n221958,314\n197197,200\n427902,5\n62042,356\n55581,316\n249182,249\n335072,10\n-1,0\n-1,1\n336060,13\n67062,355\n-1,0\n146287,60\n201690,152\n439156,90\n219264,128\n218841,25\n41878,42\n-1,1\n188293,232\n182943,203\n236884,86\n124231,91\n85850,236\n625436,25\n411216,557\n138156,89\n13022,817\n54026,307\n-1,0\n20940,199\n229436,1\n-1,0\n-1,0\n-1,0\n463351,5\n-1,0\n62345,382\n-1,1\n73926,216\n62257,172\n237832,28\n-1,0\n131268,35\n328904,100\n-1,2\n21085,916\n3329,832\n-1,4\n213779,119\n-1,1\n-1,0\n-1,0\n88715,896\n259917,17\n-1,0\n-1,0\n-1,1\n126072,77\n269810,7\n-1,0\n201660,500\n415460,352\n-1,0\n85383,198\n301869,312';

    const hiscore = parseHiscoreString(hiscoreString, new Date(2026, 6, 29, 12));

    expect(hiscore.parsedActivities[ActivityEnum.LunarChests]).toEqual({
      name: ActivityEnum.LunarChests,
      rank: 54026,
      score: 307,
    });
    expect(hiscore.parsedActivities[ActivityEnum.MadAngel]).toEqual({
      name: ActivityEnum.MadAngel,
      rank: -1,
      score: 0,
    });
    expect(hiscore.parsedActivities[ActivityEnum.MaggotKing]).toEqual({
      name: ActivityEnum.MaggotKing,
      rank: 20940,
      score: 199,
    });
    expect(hiscore.parsedActivities[ActivityEnum.Mimic]).toEqual({
      name: ActivityEnum.Mimic,
      rank: 229436,
      score: 1,
    });
  });
});
