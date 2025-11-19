import { describe, expect, it } from '@jest/globals';
import { BossEnum, MiniGameEnum } from '../../models/hiscore.enum';
import { parseHiscoreString } from '../parser';

describe('Parser with 2025-01-29 parse order', () => {
  it('should parse Collections Logged', () => {
    const hiscoreString =
      '405,2277,2075059840\n687,99,158301295\n594,99,136738886\n338,99,200000000\n213,99,200000000\n165,99,200000000\n321,99,96114273\n280,99,200000000\n24916,99,23734867\n19687,99,22183917\n22423,99,15283436\n4981,99,32591756\n751,99,200000000\n4029,99,21505619\n7142,99,21902813\n8127,99,25621082\n12434,99,15497017\n3965,99,20618080\n18641,99,21532590\n224,99,142637738\n116,99,200000000\n6905,99,20730414\n1117,99,80541346\n1019,99,19524711\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n-1,-1\n202458,2\n18,36244\n5511,600\n155,6000\n998,2577\n3,17850\n2,5301\n7,3916\n2047,10687\n-1,-1\n19087,6021\n12852,789\n9235,43948\n2,1537\n112,6682\n3118,4836\n86,5269\n14374,1002\n81816,49\n6131,1604\n17556,68\n6,102235\n29560,363\n6786,3372\n1714,2407\n305,1514\n781,1002\n9353,430\n3539,1948\n534,6723\n6397,471\n862,4850\n1029,5080\n843,4934\n25537,50\n4607,1624\n4627,2862\n2329,5717\n131,7465\n37088,142\n309,5199\n4077,3278\n80306,2670\n2235,2613\n825,2871\n9034,313\n6,380\n6363,2877\n136,5533\n143,3784\n132310,11\n5313,874\n962,4964\n2711,1486\n15089,567\n93,553\n4250,36\n72478,63\n1994,1719\n267,724\n5460,1526\n1284,680\n8217,948\n2655,1270\n2866,1474\n1417,530\n561,8119\n330,590\n393,1413\n258,82\n6989,46\n5069,2269\n368,6389\n767,3074\n2794,9067\n905,4706\n4776,1255\n4173,7877';

    const hiscore = parseHiscoreString(hiscoreString, new Date(2025, 0, 29, 12));

    expect(hiscore.minigames[MiniGameEnum.ColosseumGlory]).toEqual({
      name: MiniGameEnum.ColosseumGlory,
      rank: 9235,
      score: 43948,
    });
    expect(hiscore.minigames[MiniGameEnum.CollectionsLogged]).toEqual({
      name: MiniGameEnum.CollectionsLogged,
      rank: 2,
      score: 1537,
    });
    expect(hiscore.bosses[BossEnum.AbyssalSire]).toEqual({
      name: BossEnum.AbyssalSire,
      rank: 112,
      score: 6682,
    });
  });
});
