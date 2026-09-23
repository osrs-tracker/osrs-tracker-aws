import { describe, expect, it } from '@jest/globals';
import { ActivityEnum, SkillEnum } from '../models/hiscore.enum';
import { getOverallXpDiff, hiscoreDiff, hiscoreJsonToSourceString, parseHiscores, parseHiscoreString } from './parser';

describe('parseHiscores', () => {
  it('should parse the source string when skills and activities are missing', () => {
    const sourceString = [
      '100,99,10000',
      '200,50,2000',
      '300,40,3000',
      '400,30,4000',
      '500,20,5000',
      '600,10,6000',
      '700,71,7000',
      '800,65,8000',
      '900,90,9000',
      '1000,70,10000',
      '1100,45,11000',
      '1200,65,12000',
      '1300,80,13000',
      '1400,60,14000',
      '1500,55,15000',
      '1600,50,16000',
      '1700,45,17000',
      '1800,35,18000',
      '1900,40,19000',
      '2000,20,20000',
      '2100,75,21000',
      '2200,65,22000',
      '2300,80,23000',
      '2400,70,24000',
      '2500,60,25000',
      '2600,30,26000',
      '2700,35,27000',
      '2800,40,28000',
      '2900,45,29000',
      '3000,50,30000',
      '3100,42,31000',
      '3200,80,32000',
      '3300,77,33000',
      '3400,72,34000',
      '3500,60,35000',
      '3600,90,36000',
      '3700,88,37000',
      '3800,71,38000',
      '3900,69,39000',
      '4000,65,40000',
      '4100,95,41000',
      '4200,90,42000',
      '4300,81,43000',
      '4400,75,44000',
      '4500,70,45000',
      '4600,60,46000',
      '4700,55,47000',
      '4800,50,48000',
      '4900,45,49000',
      '5000,40,50000',
      '5100,35,51000',
      '5200,30,52000',
      '5300,25,53000',
      '5400,20,54000',
      '5500,15,55000',
      '5600,10,56000',
      '5700,25,57000',
      '5800,30,58000',
      '5900,35,59000',
      '6000,40,60000',
      '6100,45,61000',
      '6200,50,62000',
      '6300,55,63000',
      '6400,60,64000',
      '6500,65,65000',
      '6600,70,66000',
      '6700,75,67000',
      '6800,80,68000',
      '6900,85,69000',
      '7000,90,70000',
      '7100,95,71000',
      '7200,99,72000',
      '7300,98,73000',
      '7400,97,74000',
      '7500,96,75000',
      '7600,95,76000',
      '7700,94,77000',
      '7800,93,78000',
      '7900,92,79000',
      '8000,91,80000',
      '8100,90,81000',
      '8200,89,82000',
      '8300,88,83000',
      '8400,87,84000',
      '8500,86,85000',
      '8600,85,86000',
      '8700,84,87000',
      '8800,83,88000',
      '8900,82,89000',
      '9000,81,90000',
      '9100,80,91000',
      '9200,79,92000',
      '9300,78,93000',
      '9400,77,94000',
      '9500,76,95000',
      '9600,75,96000',
      '9700,74,97000',
      '9800,73,98000',
      '9900,72,99000',
      '10000,71,100000',
      '11000,70,110000',
      '12000,69,120000',
      '13000,68,130000',
      '14000,67,140000',
      '15000,66,150000',
      '16000,65,160000',
      '17000,64,170000',
      '18000,63,180000',
      '19000,62,190000',
      '20000,61,200000',
      '21000,60,210000',
      '22000,59,220000',
      '23000,58,230000',
      '24000,57,240000',
      '25000,56,250000',
      '26000,55,260000',
      '27000,54,270000',
      '28000,53,280000',
      '29000,52,290000',
      '30000,51,300000',
      '300,50',
      '400,60',
      '500,70',
    ].join('\n');

    const parsed = parseHiscoreString(sourceString, new Date(2023, 3, 10));
    const entry = {
      date: new Date(2023, 3, 11),
      scrapingOffset: 6,
      sourceString,
      skills: undefined as any,
      activities: undefined as any,
    } as any;

    const result = parseHiscores([entry]);

    expect(result).toHaveLength(1);
    expect(result[0].skills).toEqual(parsed.skills);
    expect(result[0].activities).toEqual(parsed.activities);
  });

  it('should return the entry unchanged when skills and activities are already present', () => {
    const skills = [{ id: 0, name: SkillEnum.Overall, rank: 1, level: 1, xp: 10 }];
    const activities = [{ id: 0, name: ActivityEnum.BountyHunter, rank: 2, score: 20 }];
    const entry = {
      date: new Date(2024, 0, 1),
      scrapingOffset: 3,
      sourceString: 'unused',
      skills,
      activities,
    };

    expect(parseHiscores([entry])).toEqual([entry]);
  });
});

describe('hiscoreDiff', () => {
  it('should calculate skill and activity deltas while preserving metadata values from the old entry', () => {
    const oldEntry = {
      date: new Date(2024, 0, 1),
      scrapingOffset: 0,
      sourceString: 'old-source',
      skills: [
        { id: 0, name: SkillEnum.Overall, rank: 100, level: 50, xp: 1000 },
        { id: 1, name: SkillEnum.Attack, rank: 250, level: 30, xp: 500 },
      ],
      activities: [
        { id: 0, name: ActivityEnum.BountyHunter, rank: 20, score: 200 },
        { id: 1, name: ActivityEnum.BountyHunterRogue, rank: 15, score: 80 },
      ],
    };

    const recentEntry = {
      date: new Date(2024, 0, 2),
      scrapingOffset: 0,
      sourceString: 'recent-source',
      skills: [
        { id: 0, name: SkillEnum.Overall, rank: 110, level: 52, xp: 1500 },
        { id: 1, name: SkillEnum.Attack, rank: 260, level: 31, xp: 700 },
      ],
      activities: [
        { id: 0, name: ActivityEnum.BountyHunter, rank: 30, score: 280 },
        { id: 1, name: ActivityEnum.BountyHunterRogue, rank: 18, score: 120 },
      ],
    };

    expect(hiscoreDiff(recentEntry, oldEntry)).toEqual({
      date: oldEntry.date,
      scrapingOffset: oldEntry.scrapingOffset,
      sourceString: oldEntry.sourceString,
      skills: [
        { id: 0, name: SkillEnum.Overall, rank: 10, level: 2, xp: 500 },
        { id: 1, name: SkillEnum.Attack, rank: 10, level: 1, xp: 200 },
      ],
      activities: [
        { id: 0, name: ActivityEnum.BountyHunter, rank: 10, score: 80 },
        { id: 1, name: ActivityEnum.BountyHunterRogue, rank: 3, score: 40 },
      ],
    });
  });

  it('should treat missing old entries as zero when calculating deltas', () => {
    const oldEntry = {
      date: new Date(2024, 0, 1),
      scrapingOffset: 0,
      sourceString: 'old-source',
      skills: [{ id: 0, name: SkillEnum.Overall, rank: 200, level: 10, xp: 10 }],
      activities: [],
    };

    const recentEntry = {
      date: new Date(2024, 0, 2),
      scrapingOffset: 0,
      sourceString: 'new-source',
      skills: [{ id: 0, name: SkillEnum.Overall, rank: 205, level: 12, xp: 1500 }],
      activities: [{ id: 0, name: ActivityEnum.BountyHunter, rank: 7, score: 80 }],
    };

    const diff = hiscoreDiff(recentEntry, oldEntry);

    expect(diff.skills).toEqual([{ id: 0, name: SkillEnum.Overall, rank: 5, level: 2, xp: 1490 }]);
    expect(diff.activities).toEqual([{ id: 0, name: ActivityEnum.BountyHunter, rank: 7, score: 80 }]);
  });
});

describe('getOverallXpDiff', () => {
  it('should return the overall XP delta between two hiscore entries', () => {
    const older = {
      date: new Date(2024, 0, 1),
      scrapingOffset: 0,
      sourceString: '',
      skills: [{ id: 0, name: SkillEnum.Overall, rank: 10, level: 30, xp: 1000 }],
      activities: [],
    };

    const newer = {
      date: new Date(2024, 0, 2),
      scrapingOffset: 0,
      sourceString: '',
      skills: [{ id: 0, name: SkillEnum.Overall, rank: 11, level: 31, xp: 3200 }],
      activities: [],
    };

    expect(getOverallXpDiff(newer, older)).toBe(2200);
  });

  it('should ignore negative XP values and use zero when a skill is missing', () => {
    const older = {
      date: new Date(2024, 0, 1),
      scrapingOffset: 0,
      sourceString: '',
      skills: [],
      activities: [],
    };

    const newer = {
      date: new Date(2024, 0, 2),
      scrapingOffset: 0,
      sourceString: '',
      skills: [{ id: 0, name: SkillEnum.Overall, rank: 1, level: 1, xp: -5 }],
      activities: [],
    };

    expect(getOverallXpDiff(newer, older)).toBe(0);
  });
});

describe('hiscoreJsonToSourceString', () => {
  it('should flatten skill and activity values into the expected source-string format', () => {
    const skills = [
      { id: 0, name: SkillEnum.Overall, rank: 10, level: 42, xp: 12345 },
      { id: 1, name: SkillEnum.Attack, rank: 11, level: 57, xp: 33333 },
    ];
    const activities = [
      { id: 0, name: ActivityEnum.BountyHunter, rank: 5, score: 67 },
      { id: 1, name: ActivityEnum.BountyHunterRogue, rank: 8, score: 91 },
    ];

    expect(hiscoreJsonToSourceString({ skills, activities })).toBe('10,42,12345\n11,57,33333\n5,67\n8,91');
  });
});
