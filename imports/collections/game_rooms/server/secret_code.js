import { HelperConstants } from '/imports/collections/game_rooms/constants';
import { HelperMethods } from '/imports/collections/game_rooms/methods_helper';
import { SecretInfo, secretInfoUniqueId, secretInfoUniqueIdToPlayerId }
                         from '/imports/collections/game_rooms/secret_info';

const storePreviousMerlin = function(roomId) {
  const previousMerlin = SecretInfo.findOne(
    // Query
    { $and:
      [
        { roleName: { $regex: `${HelperConstants.kMerlin}` } },
        { uniqueId: { $regex: `${roomId}` }},
      ]
    },
    // Projection (only need one field)
    { fields: {uniqueId: 1} },
  );
  if (!previousMerlin) return; // Impossible in normal games, but should cover.
  const merlinId = secretInfoUniqueIdToPlayerId(previousMerlin.uniqueId);
  Meteor.users.update({_id: merlinId}, {$set: {previousMerlinRoom: roomId}});
};

const clearPreviousMerlin = function(playerIdsInRoom, roomId) {
  const previousMerlin = Meteor.users.findOne(
    { $and:
      [
        { _id: { $in: playerIdsInRoom } },
        { previousMerlinRoom: { $eq: roomId }},
      ]
    }
  );

  // We need to clear previous Merlin for two (posisbly overlapping) sets of
  // players:
  //   1. Everyone in the room who is playing.
  //      (Might be previous Merlins in other rooms, but that should be cleared.)
  //   2. Anyone whose previousMerlinRoom is the room where a new game is
  //      starting.
  //      (A previous Merlin who is no longer in this game as it starts should
  //       not be able to be previous Merlin in a future game.)
  Meteor.users.update(
    { $or :
      [
        { _id: { $in: playerIdsInRoom } },
        { previousMerlinRoom: { $eq: roomId }},
      ]
    },
    { $unset: { previousMerlinRoom: "" } },  // "" is an unused placeholder
    { multi: true }
  );

  return previousMerlin ? previousMerlin._id : undefined;
};

export const ServerSecrets = {
  // Returns the id of previous Merlin (if in this room), or undefined otherwise.
  assignRoles(inRoomPlayers, roomId) {
    const idToRoleMap = HelperMethods.assignRolesToPlayers(inRoomPlayers);
    const previousMerlinId = clearPreviousMerlin(
        Array.from(idToRoleMap.keys()),
        roomId);
    idToRoleMap.forEach(function(role, id, map) {
      SecretInfo.insert({
        uniqueId: secretInfoUniqueId(id, roomId),
        roleName: role[HelperConstants.kRoleNameField],
        roleInfo: role[HelperConstants.kRoleKnownInfo],
        alignment: role[HelperConstants.kAlignment],
      });
    });
    return previousMerlinId;
  },

  clearRoles(inRoomPlayers, roomId) {
    storePreviousMerlin(roomId);
    SecretInfo.remove({ uniqueId: { $in: inRoomPlayers.map(
      player => secretInfoUniqueId(player._id, roomId)
    ) } });
  },

  playerAlignment(playerId, roomId) {
    return SecretInfo.findOne(
      { uniqueId: secretInfoUniqueId(playerId, roomId) },
      { fields: {alignment: 1} },
    ).alignment;
  },
}
