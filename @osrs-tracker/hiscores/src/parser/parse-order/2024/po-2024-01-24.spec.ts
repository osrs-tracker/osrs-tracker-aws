import { describe, expect, it } from '@jest/globals';
import { BossEnum, BountyHunterEnum } from '../../../models/hiscore.enum';
import { parseHiscoreString } from '../../parser';

describe('Parser with 2024-01-24 parse order', () => {
  it('should parse new scurris', () => {
    const hiscoreString =
      '29662,2277,412893314\n60733,99,21973569\n37363,99,21038715\n51220,99,33114139\n57327,99,44221838\n70048,99,39958954\n34499,99,13373152\n78574,99,20610579\n78127,99,14436977\n59847,99,13788559\n86251,99,13184630\n51249,99,13650444\n65642,99,13933700\n37083,99,14410362\n85067,99,13038084\n77902,99,13095989\n25776,99,13460001\n17417,99,13911338\n58982,99,13750029\n77538,99,14736808\n140480,99,13686733\n44726,99,13087967\n64775,99,13080480\n14895,99,13350267\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n159115,7\n-1,-1\n14635,1512\n890029,2\n12263,403\n31643,386\n13416,449\n5594,204\n29859,68\n-1,-1\n-1,-1\n-1,-1\n109537,188\n91086,249\n92002,592\n-1,-1\n64961,596\n3419,156\n207907,6\n-1,-1\n75687,762\n41830,455\n-1,-1\n130828,25\n164821,25\n100946,118\n6563,1000\n202760,28\n133125,179\n171104,217\n130469,184\n108439,25\n-1,-1\n88128,413\n68299,466\n177094,54\n50015,110\n103760,115\n126853,258\n165022,1428\n46729,270\n27133,342\n21062,8\n-1,-1\n-1,-1\n27037,20\n215320,6\n-1,-1\n154289,42\n104259,30\n-1,-1\n218294,22\n-1,-1\n197906,86\n-1,-1\n86572,177\n-1,-1\n-1,-1\n28689,179\n-1,-1\n223859,23\n34128,113\n23940,165\n61722,1\n62789,14\n10282,1051\n-1,-1\n142826,9\n248070,232\n27721,688\n10186,638\n67481,1459';

    const hiscore = parseHiscoreString(hiscoreString, new Date(2024, 0, 24, 12));

    expect(hiscore.bountyHunter[BountyHunterEnum.BountyHunterLegacy]).toEqual({
      name: BountyHunterEnum.BountyHunterLegacy,
      rank: 159115,
      score: 7,
    });
    expect(hiscore.bosses[BossEnum.Scorpia]).toEqual({
      name: BossEnum.Scorpia,
      rank: 104259,
      score: 30,
    });
    expect(hiscore.bosses[BossEnum.Scurrius]).toEqual({
      name: BossEnum.Scurrius,
      rank: -1,
      score: -1,
    });
    expect(hiscore.bosses[BossEnum.Skotizo]).toEqual({
      name: BossEnum.Skotizo,
      rank: 218294,
      score: 22,
    });
  });
});
