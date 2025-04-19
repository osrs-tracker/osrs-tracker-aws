"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayerStatus = exports.PlayerType = void 0;
var PlayerType;
(function (PlayerType) {
    PlayerType["Normal"] = "normal";
    PlayerType["Ironman"] = "ironman";
    PlayerType["Ultimate"] = "ultimate";
    PlayerType["Hardcore"] = "hardcore_ironman";
})(PlayerType || (exports.PlayerType = PlayerType = {}));
var PlayerStatus;
(function (PlayerStatus) {
    PlayerStatus["Default"] = "default";
    PlayerStatus["DeIroned"] = "de_ironed";
    PlayerStatus["DeUltimated"] = "de_ultimated";
})(PlayerStatus || (exports.PlayerStatus = PlayerStatus = {}));
//# sourceMappingURL=player.js.map