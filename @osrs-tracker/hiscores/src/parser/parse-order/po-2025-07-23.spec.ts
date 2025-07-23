import { describe, expect, it } from '@jest/globals';
import { BossEnum } from '../../models/hiscore.enum';
import { parseHiscoreString } from '../parser';

describe('Parser with 2025-07-23 parse order', () => {
  it('should parse Varlamore P3', () => {
    const hiscoreString =
      '515402,1919,87595334\n573793,93,7406912\n542297,92,6519634\n616689,99,13048325\n654398,98,12247356\n832029,92,7039641\n546517,80,2033723\n1000784,88,4802419\n786659,83,2942094\n652200,81,2360254\n700106,81,2261993\n899951,76,1380834\n788654,84,3116635\n452345,85,3360125\n666884,76,1355916\n632374,80,2098504\n470524,81,2324239\n492714,79,1850897\n672106,75,1289823\n683575,83,2887559\n667049,83,2804185\n466072,75,1220805\n688448,75,1210640\n659970,80,2032821\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n520750,96\n404454,12\n222480,33\n489874,22\n579950,26\n604481,2\n450358,1\n194000,615\n-1,-1\n-1,-1\n250678,160\n183723,546\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n386516,150\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n301931,50\n448696,55\n348209,28\n173031,25\n-1,-1\n-1,-1\n-1,-1\n513814,10\n-1,-1\n357523,31\n-1,-1\n668414,11\n-1,-1\n-1,-1\n-1,-1\n27034,286\n198512,1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n243294,35\n-1,-1\n57814,216\n512601,7\n-1,-1\n-1,-1\n376605,63\n-1,-1\n268176,5\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n636188,23\n732452,137\n-1,-1\n-1,-1\n419560,46';

    const hiscore = parseHiscoreString(hiscoreString, new Date(2025, 6, 23, 12));

    expect(hiscore.bosses[BossEnum.DerangedArchaeologist]).toEqual({
      name: BossEnum.DerangedArchaeologist,
      rank: 173031,
      score: 25,
    });
    expect(hiscore.bosses[BossEnum.DoomOfMokhaiotl]).toEqual({
      name: BossEnum.DoomOfMokhaiotl,
      rank: -1,
      score: -1,
    });
    expect(hiscore.bosses[BossEnum.DukeSucellus]).toEqual({
      name: BossEnum.DukeSucellus,
      rank: -1,
      score: -1,
    });
    expect(hiscore.bosses[BossEnum.GeneralGraardor]).toEqual({
      name: BossEnum.GeneralGraardor,
      rank: -1,
      score: -1,
    });
    expect(hiscore.bosses[BossEnum.GiantMole]).toEqual({
      name: BossEnum.GiantMole,
      rank: 513814,
      score: 10,
    });
  });
});
