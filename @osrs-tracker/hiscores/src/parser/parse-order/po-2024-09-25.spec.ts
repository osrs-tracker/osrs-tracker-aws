import { describe, expect, it } from '@jest/globals';
import { BossEnum, RaidEnum } from '../../models/hiscore.enum';
import { parseHiscoreString } from '../parser';

describe('Parser with 2024-09-25 parse order', () => {
  it('should parse Amoxiatl', () => {
    const hiscoreString =
      '2661,2277,1041057258\n46572,99,25685027\n4601,99,42527460\n7781,99,104417818\n3185,99,145580015\n3020,99,158370804\n1108,99,23850128\n2063,99,86318103\n10256,99,43420223\n18909,99,22001379\n6786,99,23896708\n10438,99,23137098\n19950,99,19476027\n2249,99,27380302\n7840,99,20196756\n16675,99,18397963\n2486,99,24256216\n9090,99,15569148\n10938,99,27156239\n2445,99,48680998\n4942,99,61463341\n15650,99,15550468\n3210,99,46102852\n1667,99,17622185\n-1,-1\n-1,-1\n50391,2\n-1,-1\n-1,-1\n-1,-1\n1813,4652\n6800,600\n2788,1036\n11072,711\n781,1374\n366,607\n3333,324\n42761,1342\n-1,-1\n52611,1716\n96444,235\n5210,44961\n7541,1529\n27839,1809\n1,5\n2644,1407\n9866,1000\n62119,644\n2490,205\n2489,3719\n56099,161\n24908,1776\n12778,1076\n14153,190\n38814,144\n21583,224\n2279,2310\n31696,280\n208,1537\n50620,541\n46048,705\n53539,520\n70762,25\n32858,360\n41411,850\n127463,243\n32906,483\n12878,227\n85869,178\n199924,169\n59421,3032\n14875,828\n2293,1588\n5413,297\n904,41\n15232,1488\n79539,15\n3517,681\n98418,14\n2946,1083\n7673,1157\n24504,222\n58059,150\n2531,129\n4439,27\n80393,36\n180535,110\n86152,38\n10602,1070\n-1,-1\n1120,2214\n3730,1005\n54488,53\n-1,-1\n5995,3604\n9837,214\n6398,515\n4288,14\n22877,27\n19378,972\n5704,1561\n11385,562\n51289,1262\n23229,723\n17419,525\n35512,2401';

    const hiscore = parseHiscoreString(hiscoreString, new Date(2024, 8, 25, 12));

    expect(hiscore.bosses[BossEnum.AlchemicalHydra]).toEqual({
      name: BossEnum.AlchemicalHydra,
      rank: 27839,
      score: 1809,
    });
    expect(hiscore.bosses[BossEnum.Amoxliatl]).toEqual({
      name: BossEnum.Amoxliatl,
      rank: 1,
      score: 5,
    });
    expect(hiscore.bosses[BossEnum.Araxxor]).toEqual({
      name: BossEnum.Araxxor,
      rank: 2644,
      score: 1407,
    });
  });

  it('should parse The Hueycoatl', () => {
    const hiscoreString =
      '195042,2098,254400256\n176426,99,15424810\n180938,99,14162486\n139722,99,21392276\n84409,99,41260754\n81950,99,41045501\n287412,87,3995029\n56729,99,25898875\n472615,92,7029128\n405073,86,3835854\n385697,90,5614101\n433554,85,3320119\n737313,83,2733491\n198013,97,11251332\n332491,85,3288843\n190432,93,7317679\n175990,91,6191236\n342179,81,2226257\n320929,85,3490274\n179336,98,12385207\n183916,99,13477235\n195656,86,3608978\n334845,83,2716702\n414627,83,2734089\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n305292,180\n424396,9\n212791,29\n414751,25\n304309,72\n106022,40\n227150,5\n212225,565\n-1,-1\n-1,-1\n76779,265\n23426,33739\n-1,-1\n120033,479\n-1,-1\n44224,211\n11913,834\n501240,84\n299947,5\n133576,57\n18159,493\n119588,533\n56187,374\n40812,32\n234291,7\n-1,-1\n-1,-1\n-1,-1\n70908,87\n186684,123\n219169,183\n211087,96\n162160,25\n22520,576\n121426,331\n428619,13\n-1,-1\n317984,30\n-1,-1\n507347,27\n194507,1360\n-1,-1\n248050,14\n169504,11\n114192,2\n132244,33\n-1,-1\n-1,-1\n338270,5\n3314,1022\n166907,48\n122438,29\n239302,14\n327816,15\n-1,-1\n16153,517\n250285,82\n250436,6\n46206,457\n5,31\n18840,289\n14598,338\n41577,117\n-1,-1\n227560,72\n116722,41\n52013,93\n83719,1\n-1,-1\n21715,853\n191563,13\n-1,-1\n455103,55\n570466,168\n162417,46\n146065,736';

    const hiscore = parseHiscoreString(hiscoreString, new Date(2024, 8, 25, 12));

    expect(hiscore.raids[RaidEnum.TheCorruptedGauntlet]).toEqual({
      name: RaidEnum.TheCorruptedGauntlet,
      rank: 46206,
      score: 457,
    });
    expect(hiscore.bosses[BossEnum.TheHueycoatl]).toEqual({
      name: BossEnum.TheHueycoatl,
      rank: 5,
      score: 31,
    });
    expect(hiscore.bosses[BossEnum.TheLeviathan]).toEqual({
      name: BossEnum.TheLeviathan,
      rank: 18840,
      score: 289,
    });
  });
});
