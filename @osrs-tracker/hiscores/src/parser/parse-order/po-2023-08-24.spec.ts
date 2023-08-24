import { describe, expect, it } from '@jest/globals';
import { BossEnum, CompetitiveEnum } from '../../models/hiscore.enum';
import { parseHiscoreString } from '../parser';

describe('Parser with 2023-08-24 parse order', () => {
  it('should parse new competitive', () => {
    const hiscoreString =
      '1,2277,4330000070\n32,99,200000000\n10,99,200000000\n479,99,200000000\n16,99,200000000\n6,99,200000000\n2,99,200000000\n7,99,200000000\n183,99,200000000\n32,99,200000000\n7,99,200000000\n82,99,200000000\n30,99,200000000\n4,99,200000000\n6,99,200000000\n16,99,200000000\n8,99,200000000\n65,99,36999992\n13,99,200000000\n2,99,200000000\n7,99,200000000\n2,99,93000078\n5,99,200000000\n2,99,200000000\n11610,27665\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n101703,2\n110796,1\n-1,-1\n-1,-1\n48926,1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n14464,72\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n16137,226\n-1,-1\n-1,-1\n425,15\n-1,-1\n-1,-1\n34244,75\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n2110,25\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n22229,63';

    const hiscore = parseHiscoreString(hiscoreString, new Date(2023, 7, 24, 1));

    expect(hiscore.competitive[CompetitiveEnum.LeaguePoints]).toEqual({
      name: CompetitiveEnum.LeaguePoints,
      rank: 11610,
      score: 27665,
    });
    expect(hiscore.competitive[CompetitiveEnum.Unknown]).toEqual({
      name: CompetitiveEnum.Unknown,
      rank: -1,
      score: -1,
    });
    expect(hiscore.bosses[BossEnum.Zulrah]).toEqual({
      name: BossEnum.Zulrah,
      rank: 22229,
      score: 63,
    });
  });
});
