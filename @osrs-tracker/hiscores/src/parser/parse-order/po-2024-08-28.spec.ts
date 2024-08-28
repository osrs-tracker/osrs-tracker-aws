import { describe, expect, it } from '@jest/globals';
import { BossEnum } from '../../models/hiscore.enum';
import { parseHiscoreString } from '../parser';

describe('Parser with 2024-03-20 parse order', () => {
  it('should parse Araxxor', () => {
    const hiscoreString =
      '34,2277,4600000000\n252,99,200000000\n209,99,200000000\n406,99,200000000\n52,99,200000000\n180,99,200000000\n160,99,200000000\n40,99,200000000\n1917,99,200000000\n365,99,200000000\n346,99,200000000\n188,99,200000000\n521,99,200000000\n278,99,200000000\n115,99,200000000\n111,99,200000000\n190,99,200000000\n108,99,200000000\n480,99,200000000\n34,99,200000000\n522,99,200000000\n75,99,200000000\n183,99,200000000\n109,99,200000000\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n175888,5\n156455,3\n722,7104\n10741,371\n1994,1222\n12906,650\n73,3464\n96,927\n1367,470\n11024,3486\n2462,3045\n25586,3813\n18590,574\n2266,47246\n14671,1121\n18991,2198\n-1,-1\n4920,1574\n4463,1763\n6616,121\n48979,279\n160211,15\n13832,2359\n22389,781\n15461,169\n29055,178\n15731,286\n3298,1946\n17102,498\n3452,591\n1084,4293\n2320,3486\n1151,4269\n21783,50\n17253,716\n72057,557\n8225,3013\n422,4593\n778,711\n1672,2417\n12308,1594\n34234,3774\n7352,1252\n19517,473\n15260,174\n476,50\n29419,782\n29728,105\n2540,867\n4725,112\n7034,697\n5910,1318\n18583,287\n14830,499\n34,1069\n2211,48\n6821,1047\n24689,424\n59082,51\n9621,1112\n24831,148\n11459,445\n27022,251\n17831,13\n61,14249\n17120,171\n1397,898\n15525,2\n1637,86\n2437,2739\n7581,1263\n8431,702\n503,27743\n178,8069\n2676,1641\n6199,6465';

    const hiscore = parseHiscoreString(hiscoreString, new Date(2024, 7, 28, 12));

    expect(hiscore.bosses[BossEnum.AlchemicalHydra]).toEqual({
      name:  BossEnum.AlchemicalHydra,
      rank: 18991	,
      score: 2198,
    });
    expect(hiscore.bosses[BossEnum.Araxxor]).toEqual({
      name: BossEnum.Araxxor,
      rank: -1,
      score: -1,
    });
    expect(hiscore.bosses[BossEnum.Artio]).toEqual({
      name: BossEnum.Artio,
      rank: 4920,
      score: 1574,
    });
  });
});
