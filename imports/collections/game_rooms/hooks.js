import { Meteor } from 'meteor/meteor';
import { _ } from 'meteor/underscore';

import { HelperConstants } from '/imports/collections/game_rooms/constants';
import { SecretInfo } from '/imports/collections/game_rooms/secret_info';

const setPlayerInRoom = function(playerId, newRoomId) {
  Meteor.users.update({_id: playerId}, {
    $set: {
      currentGameRoomId: newRoomId,
    }
  });
};

const addPlayerRoomInfo = function(playerId, newRoomId) {
  setPlayerInRoom(playerId, newRoomId);
};

const removePlayerRoomInfo = function(playerId) {
  setPlayerInRoom(playerId, HelperConstants.kNoRoomId);
  SecretInfo.remove({ playerId: playerId });  // Deletes if present.
};

export const GameRoomHooks = {
  afterInsertRoom: function(room, newRoomId) {
    room.players.forEach(function(player) {
      addPlayerRoomInfo(player._id, newRoomId);
    });
  },

  afterUpdateRoom(selector, modifier) {
    if (_.has(modifier, "$addToSet") && _.has(modifier.$addToSet, "players")) {
      check(selector._id, String); // If we start updating based on not the id, this code needs to change.

      // Note, players is just a player update "object" here, not an array of players.
      const playerId = modifier.$addToSet.players._id;
      const roomId = selector._id;
      addPlayerRoomInfo(playerId, roomId);
    }
    if (_.has(modifier, "$pull") && _.has(modifier.$pull, "players")) {
      // Note, players is just a player update "object" here, not an array of players.
      const playerId = modifier.$pull.players._id;
      removePlayerRoomInfo(playerId);
    }
  },

  afterRemoveRooms(rooms) {
    rooms.forEach(function (room) {
      room.players.forEach(player => removePlayerRoomInfo(player._id));
    });
  },
};
