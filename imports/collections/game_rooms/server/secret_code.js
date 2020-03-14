import { HelperConstants } from '/imports/collections/game_rooms/constants';
import { HelperMethods } from '/imports/collections/game_rooms/methods_helper';
import { SecretInfo } from '/imports/collections/game_rooms/secret_info';

export const ServerSecrets = {
  assignRoles(inRoomPlayers) {
    const idToRoleMap = HelperMethods.assignRolesToPlayers(inRoomPlayers);
    idToRoleMap.forEach(function(role, id, map) {
      SecretInfo.insert({
        playerId: id,
        roleName: role[HelperConstants.kRoleNameField],
        roleInfo: role[HelperConstants.kRoleKnownInfo],
      });
    });
  },

  clearRoles(inRoomPlayers) {
    SecretInfo.remove({ playerId: { $in: inRoomPlayers.map(player => player._id) } })
  }
}
