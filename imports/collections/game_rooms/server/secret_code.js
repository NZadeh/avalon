import { HelperConstants } from '/imports/collections/game_rooms/constants';
import { HelperMethods } from '/imports/collections/game_rooms/methods_helper';
import { SecretInfo, secretInfoUniqueId } from '/imports/collections/game_rooms/secret_info';

export const ServerSecrets = {
  assignRoles(inRoomPlayers, roomId) {
    const idToRoleMap = HelperMethods.assignRolesToPlayers(inRoomPlayers);
    idToRoleMap.forEach(function(role, id, map) {
      SecretInfo.insert({
        uniqueId: secretInfoUniqueId(id, roomId),
        roleName: role[HelperConstants.kRoleNameField],
        roleInfo: role[HelperConstants.kRoleKnownInfo],
        alignment: role[HelperConstants.kAlignment],
      });
    });
  },

  clearRoles(inRoomPlayers, roomId) {
    SecretInfo.remove({ uniqueId: { $in: inRoomPlayers.map(
      player => secretInfoUniqueId(player._id, roomId)
    ) } });
  },

  playerAlignment(playerId, roomId) {
    return SecretInfo.findOne({ 
        uniqueId: secretInfoUniqueId(playerId, roomId)
    }).alignment;
  },
}
