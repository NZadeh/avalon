// TODO(neemazad): Improve project structure.  https://guide.meteor.com/structure.html
import { Meteor } from 'meteor/meteor';
import { ValidatedMethod } from 'meteor/mdg:validated-method';
import SimpleSchema from 'simpl-schema';

import { GameRooms } from '/lib/collections/game_rooms/game_rooms';
import { HelperConstants } from '/lib/collections/game_rooms/constants';
import { HelperMethods } from '/lib/collections/game_rooms/methods_helper';

export const addGameRoom = new ValidatedMethod({
  name: 'avalon.addGameRoom',

  validate: new SimpleSchema({
    title: { type: String },
    password: { type: String },
    passwordProtected: { type: Boolean }
  }).validator(),

  run({ title, password, passwordProtected }) {
    var user = Meteor.user();
    var currRoomId = !!user.profile ? user.profile.currentGameRoom : false;
    var leftAt = !!user.profile ? user.profile.leftAt : false;
    if (!!currRoomId || !!leftAt) {
      return {
        alreadyInRoom: true
      };
    }

    if (title.length === 0) title = "Untitled, by " + user.username;

    var gameRoom = {
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

    var gameRoomId = GameRooms.insert(gameRoom);
    Meteor.users.update({_id: user._id}, {
      $set: {
        'profile.currentGameRoom': gameRoomId,
        'profile.leftAt': false
      }
    });

    return {
      _id: gameRoomId
    };
  },
});

export const deleteGameRoom = new ValidatedMethod({
  name: 'avalon.deleteGameRoom',

  validate: new SimpleSchema({
    roomId: { type: String }
  }).validator(),

  run({ roomId }) {
    var room = GameRooms.findOne(roomId);
    if (!isRoomOwner(room)) {
      return {
        notRoomOwner: true
      };
    }

    var players = room.players || [];
    players.map(function(player) {
      Meteor.users.update({_id: player._id}, {
        $set: {
          'profile.currentGameRoom': false,
          'profile.leftAt': false
        }
      });
    });
    GameRooms.remove(roomId);

    return {
      success: true
    };
  },
});

export const joinRoom = new ValidatedMethod({
  name: 'avalon.joinRoom',

  validate: new SimpleSchema({
    roomId: { type: String },
    password: { type: String }
  }).validator(),

  run({ roomId, password }) {
    var user = Meteor.user();
    if (!user) {
      return {
        notLoggedOn: true
      };
    }

    var currRoomId = !!user.profile ? user.profile.currentGameRoom : false;
    var leftAt = !!user.profile ? user.profile.leftAt : false;
    if (!!currRoomId || !!leftAt) {
      return {
        alreadyInRoom: true
      };
    }

    var gameRoom = GameRooms.findOne({_id: roomId});
    if (gameRoom.players.length >= HelperConstants.kMaxPlayers) {
      return {
        isAtCapacity: true
      };
    } else if (!gameRoom.open) {
      return {
        alreadyStarted: true
      };
    } else if (gameRoom.passwordProtected && password !== gameRoom.password) {
      return {
        wrongPassword: true
      };
    }

    GameRooms.update({_id: roomId}, {
      $addToSet: {
        players: {
          _id: Meteor.userId(),
          username: Meteor.user().username
        }
      }
    });

    Meteor.users.update({_id: Meteor.userId()}, {
      $set: {
        'profile.currentGameRoom': roomId,
        'profile.leftAt': false
      }
    });

    return {
      success: true
    };
  },
});

// TODO(neemazad): What happens if a client programmatically sends startGame requests...?
// Do we need to guard against that?
export const startGame = new ValidatedMethod({
  name: 'avalon.startGame',

  validate: new SimpleSchema({
    roomId: { type: String }
  }).validator(),

  run({ roomId }) {
    var gameRoom = GameRooms.findOne(roomId);
    if (gameRoom.ownerId !== Meteor.userId()) {  // TODO(neemazad): isRoomOwner?
      return {
        notRoomOwner: true
      };
    }

    var inRoomPlayers = gameRoom.players;

    if (inRoomPlayers.length < HelperConstants.kMinPlayers) {
      return { notEnoughPlayers: true };
    } else if (inRoomPlayers.length > HelperConstants.kMaxPlayers) {
      return { tooManyPlayers: true };
    }

    inRoomPlayers = HelperMethods.assignRolesToPlayers(inRoomPlayers);

    GameRooms.update({_id: roomId}, {
      $set: { 
        players: inRoomPlayers, 
        open: false
      }
    });

    return {
      success: true
    };
  },
});

// A more specific version of `removePlayer`, for security purposes.
// Uses Meteor.user() directly to prevent malicious users from removing
// other users :)
export const removeSelf = new ValidatedMethod({
  name: 'avalon.removeSelf',

  validate: null,

  run() {
    return HelperMethods.removeUserFromGame(Meteor.user());
  },
});

export const removePlayer = new ValidatedMethod({
  name: 'avalon.removePlayer',

  validate: new SimpleSchema({
    removedId: { type: String }
  }).validator(),

  run({ removedId }) {
    // TODO(neemazad): Check here that the person trying to remove is either
    //   1. self (though, really, that should be the method above)
    //   2. the owner of the room in which the removedId is a player
    return HelperMethods.removeUserFromGame(Meteor.users.findOne(removedId));
  },
});

export const backToLobby = new ValidatedMethod({
  name: 'avalon.backToLobby',

  validate: new SimpleSchema({
    roomId: { type: String }
  }).validator(),

  run({ roomId }) {
    var gameRoom = GameRooms.findOne(roomId);
    if (gameRoom.ownerId !== Meteor.userId()) { // TODO(neemazad): isRoomOwner?
      return {
        notRoomOwner: true
      };
    }

    var inRoomPlayers = gameRoom.players;
    HelperMethods.clearPlayerRolesInPlace(inRoomPlayers);
    
    GameRooms.update({_id: roomId}, {
      $set: {
        players: inRoomPlayers,
        open: true
      }
    });

    return {
      success: true
    };
  },
});
