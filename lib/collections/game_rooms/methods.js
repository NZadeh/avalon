// TODO(neemazad): Improve project structure.  https://guide.meteor.com/structure.html
import { Meteor } from 'meteor/meteor';
import { ValidatedMethod } from 'meteor/mdg:validated-method';
import { DDPRateLimiter } from 'meteor/ddp-rate-limiter';
import SimpleSchema from 'simpl-schema';

import { GameRooms } from '/lib/collections/game_rooms/game_rooms';
import { SecretInfo } from '/lib/collections/game_rooms/secret_info';

import { HelperConstants } from '/lib/collections/game_rooms/constants';
import { HelperMethods } from '/lib/collections/game_rooms/methods_helper';

import { Permissions } from '/lib/utils/permissions';

export const addGameRoom = new ValidatedMethod({
  name: 'avalon.addGameRoom',

  validate: new SimpleSchema({
    title: { type: String },
    password: { type: String },
    passwordProtected: { type: Boolean }
  }).validator(),

  run({ title, password, passwordProtected }) {
    const user = Meteor.user();
    if (!!user.currentGameRoomId) {
      return { alreadyInRoom: true };
    }

    if (title.length === 0) title = "Untitled, by " + user.username;

    const gameRoom = {
      // User inputs
      title: title,
      password: password,
      passwordProtected: passwordProtected,
      // Programmatic inputs
      ownerId: user._id,
      author: user.username,
      players: [{
        _id: user._id,
        username: user.username
      }],
      open: true,
      createdAt: new Date()
    };

    const gameRoomId = GameRooms.insert(gameRoom);

    return {_id: gameRoomId };
  },
});

export const deleteGameRoom = new ValidatedMethod({
  name: 'avalon.deleteGameRoom',

  validate: new SimpleSchema({
    roomId: { type: String }
  }).validator(),

  run({ roomId }) {
    const room = GameRooms.findOne(roomId);
    if (!Permissions.isRoomOwner(room)) {
      return { notRoomOwner: true };
    }

    GameRooms.remove(roomId);

    return { success: true };
  },
});

export const joinRoom = new ValidatedMethod({
  name: 'avalon.joinRoom',

  validate: new SimpleSchema({
    roomId: { type: String },
    password: { type: String }
  }).validator(),

  run({ roomId, password }) {
    const user = Meteor.user();
    if (!user) {
      return { notLoggedOn: true };
    }

    if (!!user.currentGameRoomId) {
      return { alreadyInRoom: true };
    }

    const gameRoom = GameRooms.findOne({_id: roomId});
    if (gameRoom.players.length >= HelperConstants.kMaxPlayers) {
      return { isAtCapacity: true };
    } else if (!gameRoom.open) {
      return { alreadyStarted: true };
    } else if (gameRoom.passwordProtected && password !== gameRoom.password) {
      return { wrongPassword: true };
    }

    GameRooms.update({_id: roomId}, {
      $addToSet: {
        players: {
          _id: Meteor.userId(),
          username: Meteor.user().username
        }
      }
    });

    return { success: true };
  },
});

export const startGame = new ValidatedMethod({
  name: 'avalon.startGame',

  validate: new SimpleSchema({
    roomId: { type: String }
  }).validator(),

  run({ roomId }) {
    const room = GameRooms.findOne(roomId);
    if (!Permissions.isRoomOwner(room)) {
      return { notRoomOwner: true };
    }

    const inRoomPlayers = room.players;

    if (inRoomPlayers.length < HelperConstants.kMinPlayers) {
      return { notEnoughPlayers: true };
    } else if (inRoomPlayers.length > HelperConstants.kMaxPlayers) {
      return { tooManyPlayers: true };
    }

    const idToRoleMap = HelperMethods.assignRolesToPlayers(inRoomPlayers);
    idToRoleMap.forEach(function(role, id, map) {
      SecretInfo.insert({
        playerId: id,
        roleName: role[HelperConstants.kRoleNameField],
        roleInfo: role[HelperConstants.kRoleKnownInfo],
      });
    });
    GameRooms.update({_id: roomId}, { $set: { open: false } });

    return { success: true };
  },
});

// A more specific version of `removePlayer`, for security purposes.
// Uses Meteor.user() directly to prevent malicious users from removing
// other users :)
export const removeSelf = new ValidatedMethod({
  name: 'avalon.removeSelf',

  validate: null,

  run() { return HelperMethods.removeUserFromGame(Meteor.user()); },
});

export const removePlayer = new ValidatedMethod({
  name: 'avalon.removePlayer',

  validate: new SimpleSchema({
    removedId: { type: String }
  }).validator(),

  run({ removedId }) {
    // Check here that the person trying to be removed is either
    //   1. self (though, really, that case should be handled by `removeSelf`), OR
    //   2. the owner of the room in which the removedId is a player.
    const currRoomId = Meteor.user().currentGameRoomId;
    const gameRoom = GameRooms.findOne({_id: currRoomId}, {
        fields: {players: 1, ownerId: 1}
    });
    if (!gameRoom) return { notAuthorized: true };

    const removedPlayerInRoom = gameRoom.containsUserId(removedId);
    const isOwner = Permissions.isRoomOwner(gameRoom);

    const allowedToRemove = removedId == Meteor.userId() || (removedPlayerInRoom && isOwner);
    if (!allowedToRemove) return { notAuthorized: true };

    return HelperMethods.removeUserFromGame(Meteor.users.findOne(removedId));
  },
});

export const backToLobby = new ValidatedMethod({
  name: 'avalon.backToLobby',

  validate: new SimpleSchema({
    roomId: { type: String }
  }).validator(),

  run({ roomId }) {
    const room = GameRooms.findOne(roomId);
    if (!Permissions.isRoomOwner(room)) {
      return { notRoomOwner: true };
    }

    SecretInfo.remove({ playerId: { $in: room.players.map(player => player._id) } })
    GameRooms.update({_id: roomId}, { $set: { open: true } });

    return { success: true };
  },
});


// TODO(neemazad): Test that this rate-limiting works, in some way.
// Get list of all method names we want to rate-limit.
const RATE_LIMITED_METHODS = _.pluck([
  addGameRoom,
  startGame,
], 'name');

if (Meteor.isServer) {
  // Only allow 1 limited operation per connection per second
  DDPRateLimiter.addRule({
    name(name) {
      return _.contains(RATE_LIMITED_METHODS, name);
    },

    // Rate limit per connection ID
    connectionId() { return true; },
  }, 1/*operation*/, /*per*/1000/*ms*/);
}