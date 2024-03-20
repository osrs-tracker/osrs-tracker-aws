import { describe, expect, it } from '@jest/globals';
import { BossEnum, MiniGameEnum } from '../../models/hiscore.enum';
import { parseHiscoreString } from '../parser';

describe('Parser with 2024-03-20 parse order', () => {
  it('should parse new varlamore p1', () => {
    const hiscoreString =
      '5438,2277,771059571\n29994,99,28726468\n24068,99,24138705\n4138,99,118840880\n5163,99,114462745\n5476,99,121240041\n4728,99,15105170\n3522,99,63232991\n75127,99,14633301\n17789,99,20856483\n24818,99,14527396\n18871,99,17825689\n28593,99,16436735\n17497,99,15195490\n9333,99,17559129\n24624,99,15386266\n10921,99,14753059\n5175,99,16985186\n36656,99,15348274\n6643,99,32472129\n25900,99,25046544\n12581,99,16085099\n28820,99,14656276\n1508,99,17545515\n-1,-1\n-1,-1\n1414,558\n456,101\n7812,501\n513,800\n1045,5535\n1474,737\n757,2012\n4188,1139\n2201,845\n734,429\n1987,373\n7607,4205\n103,4460\n24587,3616\n130570,176\n1,10050\n67819,375\n79227,751\n10214,703\n15970,1104\n9761,87\n5067,1633\n54518,102\n16067,2093\n81147,218\n8560,241\n28921,165\n764,1322\n49528,320\n49486,164\n21252,200\n50516,511\n60398,555\n55057,478\n20617,50\n17781,519\n31066,965\n79837,402\n15244,753\n10412,233\n35007,325\n28096,889\n14405,4903\n22268,566\n23241,388\n-1,-1\n4791,19\n22948,900\n21430,154\n16282,101\n13729,56\n13113,407\n33866,270\n3102,1177\n44891,127\n2931,114\n-1,-1\n5661,947\n21462,420\n50287,53\n103207,134\n8890,527\n12025,282\n20039,330\n550,635\n1889,5268\n43438,100\n19072,222\n8178,5\n28219,23\n19252,641\n7414,1196\n8339,610\n247228,245\n215871,510\n65643,150\n16910,3752';

    const hiscore = parseHiscoreString(hiscoreString, new Date(2024, 2, 20, 12));

    expect(hiscore.miniGames[MiniGameEnum.ColosseumGlory]).toEqual({
      name: MiniGameEnum.ColosseumGlory,
      rank: 1,
      score: 10050,
    });
    expect(hiscore.bosses[BossEnum.KrilTsutsaroth]).toEqual({
      name: BossEnum.KrilTsutsaroth,
      rank: 23241,
      score: 388,
    });
    expect(hiscore.bosses[BossEnum.LunarChests]).toEqual({
      name: BossEnum.LunarChests,
      rank: -1,
      score: -1,
    });
    expect(hiscore.bosses[BossEnum.Mimic]).toEqual({
      name: BossEnum.Mimic,
      rank: 4791,
      score: 19,
    });
    expect(hiscore.bosses[BossEnum.Scurrius]).toEqual({
      name: BossEnum.Scurrius,
      rank: 44891,
      score: 127,
    });
    expect(hiscore.bosses[BossEnum.SolHeredit]).toEqual({
      name: BossEnum.SolHeredit,
      rank: -1,
      score: -1,
    });
    expect(hiscore.bosses[BossEnum.Skotizo]).toEqual({
      name: BossEnum.Skotizo,
      rank: 2931,
      score: 114,
    });
  });
});
