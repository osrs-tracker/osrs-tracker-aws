import { ActivityEnum, SkillEnum } from '../../../models/hiscore.enum';
import { ParseOrder } from '../parse-order';

/** Legacy bounty hunter */
export const PO_2023_05_25: ParseOrder = [
  SkillEnum.Overall,
  SkillEnum.Attack,
  SkillEnum.Defence,
  SkillEnum.Strength,
  SkillEnum.Hitpoints,
  SkillEnum.Ranged,
  SkillEnum.Prayer,
  SkillEnum.Magic,
  SkillEnum.Cooking,
  SkillEnum.Woodcutting,
  SkillEnum.Fletching,
  SkillEnum.Fishing,
  SkillEnum.Firemaking,
  SkillEnum.Crafting,
  SkillEnum.Smithing,
  SkillEnum.Mining,
  SkillEnum.Herblore,
  SkillEnum.Agility,
  SkillEnum.Thieving,
  SkillEnum.Slayer,
  SkillEnum.Farming,
  SkillEnum.Runecraft,
  SkillEnum.Hunter,
  SkillEnum.Construction,

  ActivityEnum.LeaguePoints,

  ActivityEnum.BountyHunter, // new
  ActivityEnum.BountyHunterRogue, // new
  ActivityEnum.BountyHunterLegacy, // new
  ActivityEnum.BountyHunterLegacyRogue, // new

  ActivityEnum.ClueScrollsAll,
  ActivityEnum.ClueScrollsBeginner,
  ActivityEnum.ClueScrollsEasy,
  ActivityEnum.ClueScrollsMedium,
  ActivityEnum.ClueScrollsHard,
  ActivityEnum.ClueScrollsElite,
  ActivityEnum.ClueScrollsMaster,

  ActivityEnum.LastManStanding,
  ActivityEnum.PvpArena,

  ActivityEnum.SoulWarsZeal,
  ActivityEnum.RiftsClosed,

  ActivityEnum.AbyssalSire,
  ActivityEnum.AlchemicalHydra,
  ActivityEnum.Artio,
  ActivityEnum.BarrowsChests,
  ActivityEnum.Bryophyta,
  ActivityEnum.Callisto,
  ActivityEnum.Calvarion,
  ActivityEnum.Cerberus,

  ActivityEnum.ChambersOfXeric,
  ActivityEnum.ChambersOfXericChallengeMode,

  ActivityEnum.ChaosElemental,
  ActivityEnum.ChaosFanatic,
  ActivityEnum.CommanderZilyana,
  ActivityEnum.CorporealBeast,
  ActivityEnum.CrazyArchaeologist,
  ActivityEnum.DagannothPrime,
  ActivityEnum.DagannothRex,
  ActivityEnum.DagannothSupreme,
  ActivityEnum.DerangedArchaeologist,
  ActivityEnum.GeneralGraardor,
  ActivityEnum.GiantMole,
  ActivityEnum.GrotesqueGuardians,
  ActivityEnum.Hespori,
  ActivityEnum.KalphiteQueen,
  ActivityEnum.KingBlackDragon,
  ActivityEnum.Kraken,
  ActivityEnum.KreeArra,
  ActivityEnum.KrilTsutsaroth,
  ActivityEnum.Mimic,
  ActivityEnum.Nex,
  ActivityEnum.Nightmare,
  ActivityEnum.PhosanisNightmare,
  ActivityEnum.Obor,
  ActivityEnum.PhantomMuspah,
  ActivityEnum.Sarachnis,
  ActivityEnum.Scorpia,
  ActivityEnum.Skotizo,
  ActivityEnum.Spindel,
  ActivityEnum.Tempoross,

  ActivityEnum.TheGauntlet,
  ActivityEnum.TheCorruptedGauntlet,
  ActivityEnum.TheatreOfBlood,
  ActivityEnum.TheatreOfBloodHardMode,

  ActivityEnum.ThermoNuclearSmokeDevil,

  ActivityEnum.TombsOfAmascut,
  ActivityEnum.TombsOfAmascutExpertMode,

  ActivityEnum.TzKalZuk,
  ActivityEnum.TzTokJad,
  ActivityEnum.Venenatis,
  ActivityEnum.Vetion,
  ActivityEnum.Vorkath,
  ActivityEnum.Wintertodt,
  ActivityEnum.Zalcano,
  ActivityEnum.Zulrah,
];
