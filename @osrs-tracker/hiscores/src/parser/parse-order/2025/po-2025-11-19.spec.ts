import { describe, expect, it } from '@jest/globals';
import { ClueScrollsEnum, CompetitiveEnum, SkillEnum } from '../../../models/hiscore.enum';
import { parseHiscoreString } from '../../parser';

describe('Parser with 2025-11-19 parse order', () => {
  it('should parse with Sailing', () => {
    const hiscoreString =
      '284258,2077,199046246\n378142,99,13181132\n298870,99,13338851\n142376,99,26334974\n237907,99,28013301\n288346,99,20871973\n406841,85,3321589\n525647,98,12707249\n557959,92,6757144\n528558,86,3605209\n462647,90,5499094\n728944,80,2103224\n456415,94,8750286\n283854,93,7688768\n373254,86,3610753\n272410,92,6970297\n245799,90,5801865\n342397,84,2958397\n494544,82,2432986\n224467,98,12873732\n492498,91,5966913\n423310,78,1630748\n605677,78,1650740\n422493,84,2977021\n-1,1,0\n-1,0\n-1,0\n-1,0\n-1,0\n-1,0\n-1,0\n-1,0\n212802,337\n425376,13\n136327,64\n186009,97\n206918,133\n200733,26\n298977,4\n222018,603\n-1,2500\n-1,0\n246629,180\n213745,546\n-1,489\n119572,320\n-1,0\n24599,136\n18965,1416\n-1,0\n223294,296\n403973,5\n55947,356\n46604,311\n239947,199\n-1,3\n-1,0\n-1,1\n305348,13\n-1,0\n-1,0\n133726,60\n188801,152\n402665,90\n205990,128\n194638,25\n-1,0\n-1,1\n177390,232\n364721,40\n209359,83\n218929,57\n79358,236\n592540,25\n384477,557\n-1,1\n40681,360\n34679,307\n211682,1\n-1,0\n-1,0\n-1,0\n440438,5\n-1,0\n146298,87\n-1,1\n68142,216\n-1,0\n418266,13\n-1,0\n-1,0\n290017,100\n-1,2\n280954,10\n10968,354\n-1,4\n152721,119\n-1,1\n-1,0\n-1,0\n81984,896\n228818,17\n-1,0\n-1,0\n-1,1\n-1,1\n253373,7\n-1,0\n540205,54\n391556,352\n-1,0\n76299,198\n278809,312';

    const hiscore = parseHiscoreString(hiscoreString, new Date(2025, 10, 19, 9));

    expect(hiscore.skills[SkillEnum.Construction]).toEqual({
      name: SkillEnum.Construction,
      level: 84,
      rank: 422493,
      xp: 2977021,
    });
    expect(hiscore.skills[SkillEnum.Sailing]).toEqual({
      name: SkillEnum.Sailing,
      level: 1,
      rank: -1,
      xp: 0,
    });
    expect(hiscore.competitive[CompetitiveEnum.GridPoints]).toEqual({
      name: CompetitiveEnum.GridPoints,
      rank: -1,
      score: 0,
    });
    expect(hiscore.clueScrolls[ClueScrollsEnum.ClueScrollsAll]).toEqual({
      name: ClueScrollsEnum.ClueScrollsAll,
      rank: 212802,
      score: 337,
    });
  });
});
