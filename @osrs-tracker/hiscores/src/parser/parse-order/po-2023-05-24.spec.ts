import { describe, expect, it } from '@jest/globals';
import { BountyHunterEnum } from '../../models/hiscore.enum';
import { parseHiscoreString } from '../parser';

describe('Parser with 2023-05-24 parse order', () => {
  it('should parse new competitive minigames', () => {
    const hiscoreString =
      '162780,2078,300355280\n175865,99,14366187\n99260,99,15575979\n14419,99,58243253\n27435,99,56029323\n47309,99,45443303\n48612,99,13112747\n32156,99,26172795\n515155,87,4084826\n258221,89,4864945\n577766,80,2108814\n381931,84,3116924\n335989,92,6771502\n335328,84,2975067\n182428,87,4318172\n227224,85,3591403\n152789,90,5565649\n221007,82,2629138\n279790,83,2719148\n316931,91,6103177\n177510,99,13144302\n187242,83,2689911\n194441,85,3510659\n197317,84,3218056\n-1,-1\n2928,200\n3674,12\n3546,17\n6532,3\n59776,612\n676360,3\n213279,22\n37593,314\n151472,127\n45371,63\n20242,83\n-1,-1\n-1,-1\n-1,-1\n464615,7\n163574,45\n-1,-1\n-1,-1\n201924,238\n166327,6\n23468,341\n-1,-1\n226855,19\n97863,140\n27365,27\n100333,34\n103925,40\n149970,43\n25800,302\n106188,52\n151149,135\n226889,137\n148885,139\n106896,25\n190436,116\n14159,1710\n93697,135\n88161,76\n213990,5\n88150,344\n266206,638\n128339,31\n90806,101\n14200,9\n75546,68\n53322,32\n7094,283\n263341,5\n28104,147\n66359,106\n34608,121\n315462,12\n43170,20\n440939,10\n149203,9\n-1,-1\n15463,387\n3099,219\n-1,-1\n47253,77\n4567,382\n48032,1\n74740,12\n60194,115\n83681,23\n212419,274\n380498,224\n178533,10\n61686,1511';

    const hiscore = parseHiscoreString(hiscoreString, new Date(2023, 6, 26));

    expect(hiscore.bountyHunter[BountyHunterEnum.BountyHunter]).toEqual({
      name: BountyHunterEnum.BountyHunter,
      rank: 2928,
      score: 200,
    });
    expect(hiscore.bountyHunter[BountyHunterEnum.BountyHunterRogues]).toEqual({
      name: BountyHunterEnum.BountyHunterRogues,
      rank: 3674,
      score: 12,
    });
    expect(hiscore.bountyHunter[BountyHunterEnum.BountyHunterLegacy]).toEqual({
      name: BountyHunterEnum.BountyHunterLegacy,
      rank: 3546,
      score: 17,
    });
    expect(hiscore.bountyHunter[BountyHunterEnum.BountyHunterLegacyRogues]).toEqual({
      name: BountyHunterEnum.BountyHunterLegacyRogues,
      rank: 6532,
      score: 3,
    });
  });
});
