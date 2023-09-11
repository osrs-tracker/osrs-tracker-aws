import {
  BossEnum,
  BountyHunterEnum,
  ClueScrollsEnum,
  CompetitiveEnum,
  MiniGameEnum,
  RaidEnum,
  SkillEnum,
} from '../../models/hiscore.enum';
import { ParseOrder } from './parse-order';

/** Desert Treasure II */
export const PO_2023_07_27: ParseOrder = [
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

  CompetitiveEnum.LeaguePoints,

  BountyHunterEnum.BountyHunter,
  BountyHunterEnum.BountyHunterRogues,
  BountyHunterEnum.BountyHunterLegacy,
  BountyHunterEnum.BountyHunterLegacyRogues,

  ClueScrollsEnum.ClueScrollsAll,
  ClueScrollsEnum.ClueScrollsBeginner,
  ClueScrollsEnum.ClueScrollsEasy,
  ClueScrollsEnum.ClueScrollsMedium,
  ClueScrollsEnum.ClueScrollsHard,
  ClueScrollsEnum.ClueScrollsElite,
  ClueScrollsEnum.ClueScrollsMaster,

  CompetitiveEnum.LastManStanding,
  CompetitiveEnum.PvpArena,

  MiniGameEnum.SoulWarsZeal,
  MiniGameEnum.RiftsClosed,

  BossEnum.AbyssalSire,
  BossEnum.AlchemicalHydra,
  BossEnum.Artio,
  BossEnum.BarrowsChests,
  BossEnum.Bryophyta,
  BossEnum.Callisto,
  BossEnum.Calvarion,
  BossEnum.Cerberus,

  RaidEnum.ChambersOfXeric,
  RaidEnum.ChambersOfXericChallengeMode,

  BossEnum.ChaosElemental,
  BossEnum.ChaosFanatic,
  BossEnum.CommanderZilyana,
  BossEnum.CorporealBeast,
  BossEnum.CrazyArchaeologist,
  BossEnum.DagannothPrime,
  BossEnum.DagannothRex,
  BossEnum.DagannothSupreme,
  BossEnum.DerangedArchaeologist,
  BossEnum.DukeSucellus, // new
  BossEnum.GeneralGraardor,
  BossEnum.GiantMole,
  BossEnum.GrotesqueGuardians,
  BossEnum.Hespori,
  BossEnum.KalphiteQueen,
  BossEnum.KingBlackDragon,
  BossEnum.Kraken,
  BossEnum.KreeArra,
  BossEnum.KrilTsutsaroth,
  BossEnum.Mimic,
  BossEnum.Nex,
  BossEnum.Nightmare,
  BossEnum.PhosanisNightmare,
  BossEnum.Obor,
  BossEnum.PhantomMuspah,
  BossEnum.Sarachnis,
  BossEnum.Scorpia,
  BossEnum.Skotizo,
  BossEnum.Spindel,
  BossEnum.Tempoross,

  RaidEnum.TheGauntlet,
  RaidEnum.TheCorruptedGauntlet,

  BossEnum.TheLeviathan, // new
  BossEnum.TheWhisperer, // new

  RaidEnum.TheatreOfBlood,
  RaidEnum.TheatreOfBloodHardMode,

  BossEnum.ThermoNuclearSmokeDevil,

  RaidEnum.TombsOfAmascut,
  RaidEnum.TombsOfAmascutExpertMode,

  BossEnum.TzKalZuk,
  BossEnum.TzTokJad,
  BossEnum.Vardorvis, // new
  BossEnum.Venenatis,
  BossEnum.Vetion,
  BossEnum.Vorkath,
  BossEnum.Wintertodt,
  BossEnum.Zalcano,
  BossEnum.Zulrah,
];
