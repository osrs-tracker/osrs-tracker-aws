import { describe, expect, it } from '@jest/globals';
import { BossEnum } from '../../models/hiscore.enum';
import { parseHiscoreString } from '../parser';

describe('Parser with 2023-07-27 parse order', () => {
  it('should parse new bosses', () => {
    const hiscoreString =
      '164811,2079,304655587\n175076,99,14449268\n94555,99,15846659\n14610,99,59397622\n27230,99,57105105\n47314,99,46277925\n23556,99,13412747\n31561,99,26660220\n522074,87,4084826\n262367,89,4865440\n583937,80,2108814\n387279,84,3116924\n340274,92,6771502\n341587,84,2975067\n185595,87,4318172\n224811,86,3678424\n155758,90,5568255\n224524,82,2630008\n284854,83,2719156\n320582,91,6103177\n180402,99,13145920\n190236,83,2689911\n197576,85,3510659\n200750,84,3219786\n-1,-1\n3304,200\n4058,12\n-1,-1\n-1,-1\n60927,612\n684516,3\n215781,22\n38106,314\n153098,127\n46202,63\n20673,83\n-1,-1\n-1,-1\n-1,-1\n481125,7\n165579,45\n-1,-1\n-1,-1\n204418,238\n168733,6\n23794,342\n-1,-1\n230070,19\n98672,140\n27165,29\n101722,34\n105099,40\n152056,43\n26085,302\n107313,52\n152658,135\n229416,137\n150255,139\n107666,25\n39193,21\n193472,116\n14430,1710\n94904,135\n89908,76\n220091,5\n88868,344\n269183,638\n129860,31\n91820,101\n14396,9\n77398,68\n51785,35\n7366,283\n266047,5\n31079,147\n67535,106\n34998,121\n318278,12\n46971,20\n457535,10\n156417,9\n-1,-1\n16738,19\n9862,68\n15347,395\n3150,220\n-1,-1\n46277,81\n4631,393\n48183,1\n75384,12\n26671,58\n60953,115\n86340,23\n215048,274\n385346,224\n183171,10\n62453,1511';

    const hiscore = parseHiscoreString(hiscoreString, new Date(2023, 7, 19));

    expect(hiscore.bosses[BossEnum.DukeSucellus]).toEqual({
      name: BossEnum.DukeSucellus,
      rank: 39193,
      score: 21,
    });
    expect(hiscore.bosses[BossEnum.TheLeviathan]).toEqual({
      name: BossEnum.TheLeviathan,
      rank: 16738,
      score: 19,
    });
    expect(hiscore.bosses[BossEnum.TheWhisperer]).toEqual({
      name: BossEnum.TheWhisperer,
      rank: 9862,
      score: 68,
    });
    expect(hiscore.bosses[BossEnum.Vardorvis]).toEqual({
      name: BossEnum.Vardorvis,
      rank: 26671,
      score: 58,
    });
  });
});
