import SimpleSchema from 'simpl-schema';
import { DDPRateLimiter } from 'meteor/ddp-rate-limiter';
import { Meteor } from 'meteor/meteor';
import { ValidatedMethod } from 'meteor/mdg:validated-method';

import { GameRooms } from '/imports/collections/game_rooms/game_rooms';
import { HelperConstants } from '/imports/collections/game_rooms/constants';
import { HelperMethods } from '/imports/collections/game_rooms/methods_helper';
import { InGameInfo, VoteHistory } from '/imports/collections/game_rooms/in_game_info.js';
import { Permissions } from '/imports/utils/permissions';

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
    const room = GameRooms.findOne(roomId, {fields: {ownerId: 1}});
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

    const gameRoom = GameRooms.findOne(
        { _id: roomId },
        { fields:
          {
            players: 1,
            open: 1,
            passwordProtected: 1,
            password: 1,
          }
        },
    );
    const rejoining = user.previousGameRoomIds &&
                      user.previousGameRoomIds.includes(roomId);

    if (rejoining) {
      // Handle the "rejoin" case first.
      GameRooms.update(
        {
          _id: roomId,
          players: { $elemMatch: { _id: user._id } },
        },
        { $set: { "players.$.gone": false } }
      );
    } else {
      // Then handle the normal join case.
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
    }

    return { success: true };
  },
});

export const startGame = new ValidatedMethod({
  name: 'avalon.startGame',

  validate: new SimpleSchema({
    roomId: { type: String }
  }).validator(),

  run({ roomId }) {
    const room = GameRooms.findOne(
        roomId,
        { fields: { ownerId: 1, players: 1} },
    );
    if (!Permissions.isRoomOwner(room)) {
      return { notRoomOwner: true };
    }

    const inRoomPlayers = room.players;

    if (inRoomPlayers.length < HelperConstants.kMinPlayers) {
      return { notEnoughPlayers: true };
    } else if (inRoomPlayers.length > HelperConstants.kMaxPlayers) {
      return { tooManyPlayers: true };
    }

    GameRooms.update({_id: roomId}, { $set: { open: false } });

    // The code after this point in the method relies on randomness.
    // When the client (specifically room host's client) runs the optimistic
    // UI calculation, it will often show some random assignment of roles
    // to the user in the time between when the room owner hits the Start
    // button on their device and when the server finishes its computation
    // and sends the result back to everybody. By returning early, we can
    // avoid a surprising, ephemeral role assignment for the room owner.
    if (this.isSimulation) {
      return { waitingForServer: true };
    } 

    const { ServerSecrets } =
        require('/imports/collections/game_rooms/server/secret_code.js');
    const previousMerlinId = ServerSecrets.assignRoles(inRoomPlayers, roomId);

    const inGameInfo = HelperMethods.generateStartingInGameInfo(
        inRoomPlayers, previousMerlinId, roomId);
    const inGameId = InGameInfo.insert(inGameInfo);
    GameRooms.update({_id: roomId}, { $set: { inGameInfoId: inGameId } });
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

    const removedPlayerInRoom = gameRoom.includesUserId(removedId);
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
    const room = GameRooms.findOne(
        roomId,
        { fields: { ownerId: 1, players: 1, inGameInfoId: 1 } },
    );
    if (!Permissions.isRoomOwner(room)) {
      return { notRoomOwner: true };
    }

    if (!this.isSimulation) {
      const { ServerSecrets } =
        require('/imports/collections/game_rooms/server/secret_code.js');
      ServerSecrets.clearRoles(room.players, room._id);
    }

    // Consider unifying the code with hooks.js `afterRemoveRooms`. It's mostly
    // the same (clear roles and delete in game info, but slightly different.)
    InGameInfo.remove({_id: room.inGameInfoId});
    GameRooms.update({_id: roomId}, {
      $set: { open: true },
      $unset: { inGameInfoId: "" },  // "" is an unused placeholder
    });
    return { success: true };
  },
});

// ------------------------------------- //
// Below this point are in-game methods. //
// ------------------------------------- //
export const toggleOnProposal = new ValidatedMethod({
  name: 'avalon.toggleOnProposal',

  validate: new SimpleSchema({
    roomId: {
      type: String,
      regEx: SimpleSchema.RegEx.Id,
    },
    playerName: String,
  }).validator(),

  run({ roomId, playerName }) {
    const room = GameRooms.findOne(
        roomId,
        { fields: { inGameInfoId: 1, players: 1 } },
    );
    const existingInfo = room.inGameInfo({fields: {
      proposer: 1,
      gamePhase: 1,
      selectedOnMission: 1,
    }});
    const playerId = room.nameToId(playerName);

    if (existingInfo.isGameOverState()) {
      return { gameOver: true };
    }

    // this.userId is the ID of the method's caller.
    if (this.userId != existingInfo.proposer) {
      return { notProposer: true };
    }
    if (!room.includesUserId(playerId)) {
      return { playerNotInRoom: true };
    }
    if (existingInfo.gamePhase === "missionInProgress") {
      return { missionAlreadyInProgress: true };
    }

    // There might be a more concise phrasing where we can conditionally
    // give the selector $pull or $push, but not sure how. Do the long form
    // way for now...
    if (existingInfo.selectedOnMission.includes(playerId)) {
      InGameInfo.update({_id: room.inGameInfoId},
        { $pull: { selectedOnMission: playerId } });
    } else {
      InGameInfo.update({_id: room.inGameInfoId},
        { $addToSet: { selectedOnMission: playerId } });
    }

    return { success: true };
  },
});

export const finalizeProposal = new ValidatedMethod({
  name: 'avalon.finalizeProposal',

  validate: new SimpleSchema({
    roomId: {
      type: String,
      regEx: SimpleSchema.RegEx.Id,
    },
  }).validator(),

  run({ roomId }) {
    const room = GameRooms.findOne(roomId, {fields: {inGameInfoId: 1}});
    const existingInfo = room.inGameInfo({fields: {
      proposer: 1,
      gamePhase: 1,
      selectedOnMission: 1,
      // TODO(neemazad): Figure out a better way of "exporting"
      // this... maybe each function call should also export
      // what fields it needs in an object, and we can `...unpack``
      // it into this object.
      missionCounts: 1,
      currentMissionNumber: 1,
      selectedOnMission: 1,
    }});

    if (existingInfo.isGameOverState()) {
      return { gameOver: true};
    }

    // this.userId is the ID of the method's caller.
    if (this.userId != existingInfo.proposer) {
      return { notProposer: true};
    }
    if (existingInfo.gamePhase === "proposalVoteInProgress") {
      return { voteAlreadyInProgress: true };
    }

    const numShouldBeOnProposal = existingInfo.numShouldBeOnProposal();
    const numOnProposal = existingInfo.numCurrentlyOnProposal();

    if (numOnProposal != numShouldBeOnProposal) {
      return { incorrectNumPlayers: numOnProposal, needs: numShouldBeOnProposal};
    }

    InGameInfo.update({_id: room.inGameInfoId},
      { $set: { gamePhase: "proposalVoteInProgress" }});

    return { success: true };
  },
});

export const voteOnProposal = new ValidatedMethod({
  name: 'avalon.voteOnProposal',

  validate: new SimpleSchema({
    roomId: {
      type: String,
      regEx: SimpleSchema.RegEx.Id,
    },
    vote: Boolean, // True is accept, false is reject.
  }).validator(),

  run({ roomId, vote }) {
    const room = GameRooms.findOne(
        roomId,
        { fields: { inGameInfoId: 1, players: 1 } },
    );
    const existingInfo = room.inGameInfo({fields: {
      gamePhase: 1,
      liveVoteTally: 1,
    }});
    const voterId = this.userId;

    if (existingInfo.isGameOverState()) {
      return { gameOver: true};
    }

    if (!room.includesUserId(voterId)) {
      return { playerNotInRoom: true };
    }

    if (existingInfo.gamePhase !== "proposalVoteInProgress") {
      return { proposalNotFinalized: true };
    }

    // TODO(neemazad): It seems like theoretically there's a race condition here
    // with checking whether the player has already voted. If the player can
    // call the method twice quickly, it seems impossible to guarantee that
    // the player isn't voting twice. There might be something we can do with
    // `upsert` or `setOnInsert`... but not sure atm.
    //
    // We rely on server-side rate-limiting of this method, as well as using
    // `addToSet` to mitigate duplicates.
    const found = existingInfo.liveVoteTally.find(function(talliedVote) {
      return voterId === talliedVote.playerId;
    });
    if (!!found) {
      return { alreadyVoted: true };
    }

    const voteObject = { playerId: voterId, vote: vote};
    InGameInfo.update({_id: room.inGameInfoId}, {
      $addToSet: { liveVoteTally: voteObject }
    });
    // Note that the Database updates automatically when all the votes are in,
    // so we don't need to handle that here.

    return { success: true };  // TODO(neemazad): maybe return vote as read from db?
  },
});

export const voteOnMission = new ValidatedMethod({
  name: 'avalon.voteOnMission',

  validate: new SimpleSchema({
    roomId: {
      type: String,
      regEx: SimpleSchema.RegEx.Id,
    },
    vote: Boolean, // True is Suuccess, false is Fail.
  }).validator(),

  // TODO(neemazad): Near-dup of voteOnProposal -- consider unifying.
  run({ roomId, vote }) {
    const room = GameRooms.findOne(
        roomId,
        { fields: { inGameInfoId: 1, players: 1 } },
    );
    const existingInfo = room.inGameInfo({fields: {
      gamePhase: 1,
      selectedOnMission: 1,
      liveMissionTally: 1,
    }});

    const voterId = this.userId;

    if (existingInfo.isGameOverState()) {
      return { gameOver: true};
    }

    if (!room.includesUserId(voterId)) {
      return { playerNotInRoom: true };
    }

    if (existingInfo.gamePhase !== "missionInProgress") {
      return { missionNotFinalized: true };
    }

    if (!existingInfo.selectedOnMission.includes(voterId)) {
      return { notOnMission: true };
    }

    // TODO(neemazad): It seems like theoretically there's a race condition here
    // with checking whether the player has already voted. If the player can
    // call the method twice quickly, it seems impossible to guarantee that
    // the player isn't voting twice. There might be something we can do with
    // `upsert` or `setOnInsert`... but not sure atm.
    //
    // We rely on server-side rate-limiting of this method, as well as using
    // `addToSet` to mitigate duplicates.
    const found = existingInfo.liveMissionTally.find(function(talliedVote) {
      return voterId === talliedVote.playerId;
    });
    if (!!found) {
      return { alreadyVoted: true };
    }

    // The info after this point requires "SECRET CODE!!!". Return early
    // on the client, even though the client has access to the information
    // returned by the secret code anyways...
    if (this.isSimulation) {
      return { waitingForServer: true };
    } 

    const { ServerSecrets } =
        require('/imports/collections/game_rooms/server/secret_code.js');
    if (vote === false &&
        ServerSecrets.playerAlignment(voterId, roomId) != HelperConstants.kSpy) {
      return { cantFail: true };
    }

    const voteObject = { playerId: voterId, vote: vote};
    InGameInfo.update({_id: room.inGameInfoId}, {
      $addToSet: { liveMissionTally: voteObject }
    });
    // Note that the Database updates automatically when all the votes are in,
    // so we don't need to handle that here.

    return { success: true };  // TODO(neemazad): maybe return vote as read from db?
  },
});

export const toggleOnAssassinationList = new ValidatedMethod({
  name: 'avalon.toggleOnAssassinationList',

  validate: new SimpleSchema({
    roomId: {
      type: String,
      regEx: SimpleSchema.RegEx.Id,
    },
    playerName: String,
  }).validator(),

  run({ roomId, playerName }) {
    const room = GameRooms.findOne(
        roomId,
        { fields: { inGameInfoId: 1, players: 1 } },
    );
    const existingInfo = room.inGameInfo({fields: {
      gamePhase: 1,
      playersInGame: 1,  // for isKnownAssassin (TODO(neemazad): get from function?)
      selectedForAssassination: 1,
    }});
    const playerId = room.nameToId(playerName);

    if (existingInfo.isGameOverState()) {
      return { gameOver: true };
    }

    // this.userId is the ID of the method's caller.
    if (!existingInfo.isKnownAssassin(this.userId)) {
      return { notAssassin: true };
    }
    if (!room.includesUserId(playerId)) {
      return { playerNotInRoom: true };
    }
    if (existingInfo.gamePhase !== "assassinationPhase") {
      return { notAssassinationPhase: true };
    }

    // There might be a more concise phrasing where we can conditionally
    // give the selector $pull or $push, but not sure how. Do the long form
    // way for now...
    if (existingInfo.selectedForAssassination.includes(playerId)) {
      InGameInfo.update({_id: room.inGameInfoId},
        { $pull: { selectedForAssassination: playerId } });
    } else {
      InGameInfo.update({_id: room.inGameInfoId},
        { $addToSet: { selectedForAssassination: playerId } });
    }

    return { success: true };
  },
});

export const finalizeAssassination = new ValidatedMethod({
  name: 'avalon.finalizeAssassination',

  validate: new SimpleSchema({
    roomId: {
      type: String,
      regEx: SimpleSchema.RegEx.Id,
    },
  }).validator(),

  run({ roomId }) {
    const room = GameRooms.findOne(
        roomId,
        { fields: { inGameInfoId: 1 } },
    );
    const existingInfo = room.inGameInfo({fields: {
      gamePhase: 1,
      playersInGame: 1,  // for isKnownAssassin (TODO(neemazad): get from function?)
      selectedForAssassination: 1,
    }});

    if (existingInfo.isGameOverState()) {
      return { gameOver: true};
    }

    // this.userId is the ID of the method's caller.
    if (!existingInfo.isKnownAssassin(this.userId)) {
      return { notAssassin: true };
    }
    if (existingInfo.gamePhase !== "assassinationPhase") {
      return { notAssassinationPhase: true };
    }

    const numOnList = existingInfo.numCurrentlyOnAssassinationList();
    if (numOnList !== 1) {
      return { incorrectNumPlayers: numOnList, needs: 1};
    }

    // The code after this point relies on information that is unknown to the
    // Assassin's client. In particular, the Assassin's client cannot
    // role-reveal Merlin's role, so the optimistic UI calculation incorrectly
    // shows "Merlin is hidden" regardless of target. It is better to just make
    // the Assassin wait for the server, like everyone else.
    if (this.isSimulation) {
      return { waitingForServer: true };
    } 

    // Let the database code handle the implementation of this logic... :)
    InGameInfo.update({_id: room.inGameInfoId},
      { $set: { gamePhase: "resolveAssassination" }});

    return { success: true };
  },
});


// Get list of all method names we want to rate-limit.
const RATE_LIMITED_METHODS = _.pluck([
  addGameRoom,
  startGame,
  voteOnProposal,
  voteOnMission,
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
