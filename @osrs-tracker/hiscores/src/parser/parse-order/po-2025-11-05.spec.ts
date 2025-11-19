import { describe, expect, it } from '@jest/globals';
import { BossEnum } from '../../models/hiscore.enum';
import { parseHiscoreString } from '../parser';

describe('Parser with 2025-11-05 parse order', () => {
  it('should parse with Shellbane Gryphon', () => {
    const hiscoreString =
      '302781,2062,188170292\n387599,99,13137505\n392912,99,13035235\n159619,99,24268043\n256750,99,26672473\n298020,99,20224003\n426638,84,3246775\n553430,97,11697404\n592387,91,5921154\n581509,85,3258673\n528513,88,4389755\n809583,78,1786633\n453011,94,8750286\n290185,93,7455814\n412166,85,3269828\n293999,92,6519801\n257057,90,5606952\n354105,83,2764326\n527776,81,2196319\n232716,98,12228852\n500343,90,5704013\n425254,77,1594520\n601471,78,1646777\n471318,83,2795151\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n219656,324\n421872,13\n140916,61\n189329,94\n212670,129\n219004,23\n297726,4\n221657,603\n-1,-1\n-1,-1\n243048,180\n211064,546\n-1,-1\n118234,320\n-1,-1\n115124,34\n18482,1413\n-1,-1\n251148,262\n-1,-1\n55438,356\n45908,311\n238296,199\n-1,-1\n-1,-1\n-1,-1\n303402,13\n-1,-1\n-1,-1\n133011,60\n188000,152\n400258,90\n205114,128\n192973,25\n-1,-1\n-1,-1\n-1,-1\n363007,40\n366718,12\n241170,52\n78935,236\n590725,25\n382783,557\n-1,-1\n51348,298\n33447,307\n210414,1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n145176,87\n-1,-1\n66952,216\n-1,-1\n416401,13\n-1,-1\n-1,-1\n414867,64\n-1,-1\n277894,10\n13565,306\n-1,-1\n148517,119\n-1,-1\n-1,-1\n-1,-1\n81549,896\n237245,15\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n252266,7\n-1,-1\n537751,54\n389217,352\n-1,-1\n86475,169\n277385,312';

    const hiscore = parseHiscoreString(hiscoreString, new Date(2025, 10, 5, 12));

    expect(hiscore.bosses[BossEnum.Scurrius]).toEqual({
      name: BossEnum.Scurrius,
      rank: 66952,
      score: 216,
    });
    expect(hiscore.bosses[BossEnum.ShellbaneGryphon]).toEqual({
      name: BossEnum.ShellbaneGryphon,
      rank: -1,
      score: -1,
    });
    expect(hiscore.bosses[BossEnum.Skotizo]).toEqual({
      name: BossEnum.Skotizo,
      rank: 416401,
      score: 13,
    });
  });
});
