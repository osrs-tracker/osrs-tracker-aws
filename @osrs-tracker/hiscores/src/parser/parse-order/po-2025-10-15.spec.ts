import { describe, expect, it } from '@jest/globals';
import { CompetitiveEnum, SkillEnum } from '../../models/hiscore.enum';
import { parseHiscoreString } from '../parser';

describe('Parser with 2025-10-15 parse order', () => {
  it('should parse with Grid Points', () => {
    const hiscoreString =
      '14227,200,214444\n19148,2,125\n19719,1,0\n24863,1,0\n25117,10,1357\n19130,1,0\n14398,1,22\n19390,8,890\n19834,1,0\n31602,1,0\n16206,1,0\n2687,43,50898\n28937,1,0\n16368,1,0\n22834,10,1299\n2859,43,54111\n5434,3,256\n11234,17,3445\n9307,50,102041\n11980,1,0\n10109,1,0\n9595,1,0\n11810,1,0\n9569,1,0\n8815,700\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1';

    const hiscore = parseHiscoreString(hiscoreString, new Date(2025, 9, 15, 12));

    expect(hiscore.skills[SkillEnum.Construction]).toEqual({
      name: SkillEnum.Construction,
      rank: 9569,
      level: 1,
      xp: 0,
    });
    expect(hiscore.competitive[CompetitiveEnum.GridPoints]).toEqual({
      name: CompetitiveEnum.GridPoints,
      rank: 8815,
      score: 700,
    });
    expect(hiscore.competitive[CompetitiveEnum.LeaguePoints]).toEqual({
      name: CompetitiveEnum.LeaguePoints,
      rank: -1,
      score: -1,
    });
  });
});
