import { HiscoreEntry } from '@osrs-tracker/models';

import { ActivityEnum, SkillEnum } from './hiscore.enum';

export type Skill = {
  name: SkillEnum;
  rank: number;
  level: number;
  xp: number;
};

export type Activity = {
  name: ActivityEnum;
  rank: number;
  score: number;
};

export type Hiscore = HiscoreEntry & {
  parsedSkills: { [key in SkillEnum]: Skill };
  parsedActivities: { [key in ActivityEnum]: Activity };
};

export type HiscoreLineType = SkillEnum | ActivityEnum;
