import { Meteor } from 'meteor/meteor';
import { _ } from 'meteor/underscore';

import { HelperConstants } from '/imports/collections/game_rooms/constants';
import { GameRooms } from '/imports/collections/game_rooms/game_rooms';
import { InGameInfo, VoteHistory } from '/imports/collections/game_rooms/in_game_info.js';
import { SecretInfo, secretInfoUniqueId } from '/imports/collections/game_rooms/secret_info';

const setPlayerInRoom = function(playerId, newRoomId) {
  Meteor.users.update({_id: playerId}, {
    $set: {
      currentGameRoomId: newRoomId,
    }
  });
};

const setPlayerPrevRoom = function(playerId, prevRoomId) {
  Meteor.users.update({_id: playerId}, {
    $addToSet: {
      previousGameRoomIds: prevRoomId,
    }
  });
};

const addPlayerRoomInfo = function(playerId, newRoomId) {
  setPlayerInRoom(playerId, newRoomId);
};

const removePreviousRoomInfo = function(playerId, roomId) {
  Meteor.users.update({_id: playerId}, {
    $pull: {
      previousGameRoomIds: roomId,
    }
  });
};

const playerRejoins = function(playerId, roomId) {
  addPlayerRoomInfo(playerId, roomId);
  removePreviousRoomInfo(playerId, roomId);
};

const markPlayerAsRemovedFromRoom = function(playerId, roomId) {
  setPlayerInRoom(playerId, HelperConstants.kNoRoomId);
  if (roomId) {
    setPlayerPrevRoom(playerId, roomId);
  }
};

const removePlayerRoomInfoForGood = function(playerId, roomId) {
  markPlayerAsRemovedFromRoom(playerId);
  // This room no longer is viable for a player to re-join.
  removePreviousRoomInfo(playerId, roomId);
  // Deletes if present.
  SecretInfo.remove({ uniqueId: secretInfoUniqueId(playerId, roomId) });
};

export const GameRoomHooks = {
  afterInsertRoom(room, newRoomId) {
    room.players.forEach(function(player) {
      addPlayerRoomInfo(player._id, newRoomId);
    });
  },

  beforeUpdateRoom(selector, modifier) {
    if (_.has(modifier, "$pull") &&
        _.has(modifier.$pull, "players") &&
        _.has(modifier.$pull.players, "_id")) {
      const playerId = modifier.$pull.players._id;
      const room = GameRooms.findOne(selector);
      if (room.open) {
        // Continue with the removal as planned.
        return true;
      }

      const roomId = room._id;
      // Otherwise, we mark the player as absent and clean up later.
      // NOTE: see the branch in `afterUpdateRoom` that cleans up
      // if all players are gone.
      GameRooms.update(
        {
          _id: roomId,
          players: { $elemMatch: { _id: playerId } },
        },
        { $set: { "players.$.gone": true } }
      );
      markPlayerAsRemovedFromRoom(playerId, roomId);

      return false;
    }

    // By default... continue updating.
    return true;
  },

  afterUpdateRoom(selector, modifier) {
    if (_.has(modifier, "$addToSet") && _.has(modifier.$addToSet, "players")) {
      check(selector._id, String); // If we start updating based on not the id, this code needs to change.

      // Note, players is just a player update "object" here, not an array of players.
      const playerId = modifier.$addToSet.players._id;
      const roomId = selector._id;
      addPlayerRoomInfo(playerId, roomId);
    }

    if (_.has(modifier, "$pull") &&
        _.has(modifier.$pull, "players") &&
        _.has(modifier.$pull.players, "_id")) {
      check(selector._id, String); // If we start updating based on not the id, this code needs to change.

      // Note, players is just a player update "object" here, not an array of players.
      const playerId = modifier.$pull.players._id;
      const roomId = selector._id;
      removePlayerRoomInfoForGood(playerId, roomId);
    }

    if (_.has(modifier, "$set")) {
      if (_.has(modifier.$set, "open") && modifier.$set.open) {
        check(selector._id, String); // If we start updating based on not the id, this code needs to change.

        // Previously, we delayed removing these players from the GameRoom while the game
        // was in progress. Now we can clean up all players who are "gone" from the room.
        const roomId = selector._id;
        const room = GameRooms.findOne({_id: roomId});

        room.players.forEach(function(player) {
          if (player.gone) {
            removePlayerRoomInfoForGood(player._id, room._id);
          }
        });

        GameRooms.update(
          {_id: roomId},
          { $pull: { players: { gone: true } } },
          { multi: true }
        );
      } else if (_.has(modifier.$set, "players.$.gone")) {
        if (modifier.$set["players.$.gone"] === false) {
          const roomId = selector._id;
          const playerId = selector.players.$elemMatch._id;

          check(roomId, String);
          check(playerId, String);

          // Player is returning...!
          playerRejoins(playerId, roomId);
        }
      }
    }
  },

  afterRemoveRooms(rooms) {
    rooms.forEach(function(room) {
      room.players.forEach(
        player => removePlayerRoomInfoForGood(player._id, room._id)
      );
      InGameInfo.remove({_id: room.inGameInfoId});
    });
  },
};

// --------------------------------

const calculateNextProposer = function(inGameInfo) {
  const players = inGameInfo.playersInGame;
  const proposingIndex = players.findIndex(function(player) {
    return player._id == inGameInfo.proposer;
  });
  console.assert(0 <= proposingIndex && proposingIndex < players.length,
                 "Unable to find current proposer when moving to next proposal...");
  const nextIndex = (proposingIndex + 1) % players.length;
  return players[nextIndex]._id;
};

const tallyVotes = function(voteObjectList) {
  var approves = 0;
  var rejects = 0;
  voteObjectList.forEach(function(talliedVote) {
    if (talliedVote.vote) {
      ++approves;
    } else {
      ++rejects;
    }
  });
  return [approves, rejects];
}

const calculateConditionalProposalUpdates = function(inGameInfo) {
  const [approves, rejects] = tallyVotes(inGameInfo.liveVoteTally);

  const passed = approves > rejects;
  const isFifth = inGameInfo.currentProposalNumber == 5;
  return {
    proposalPassed: passed,
    rejectedFifth: (!passed && isFifth),
    nextProposerId: calculateNextProposer(inGameInfo),
  };
};

const copyVoteTallyInfoToPersonalHistory = function(updatedInfo) {
  const map = updatedInfo.playerIdToVoteHistoryIdMap();
  updatedInfo.liveVoteTally.forEach(function(singleVote) {
    const playerId = singleVote.playerId;
    const voteUpdate = {
      vote: singleVote.vote,
      wasProposer: updatedInfo.proposer === playerId,
      wasOnProposal: updatedInfo.selectedOnMission.includes(playerId),
    }
    const voteHistoryId = map.get(playerId);

    const voteHistory = VoteHistory.findOne({_id: voteHistoryId});
    console.assert(!!voteHistory, "Could not find valid vote history.");

    const missionIndexToUpdate = voteHistory.missions.length - 1;
    // Build up the update from scratch, so that we can use MongoDB
    // dot notation to access the correct array index in missions.
    // { $push: { `missions.${missionIndexToUpdate}` : voteUpdate} }
    var update = { $push: {} };
    update.$push[`missions.${missionIndexToUpdate}`] = voteUpdate;
    VoteHistory.update({_id: voteHistoryId}, update);
  });
};

const calculateConditionalMissionUpdates = function(inGameInfo) {
  const [successes, fails] = tallyVotes(inGameInfo.liveMissionTally);

  const [missionsSucceeded, missionsFailed] =
      inGameInfo.missionSuccessFailCounts();

  const thisMissionSucceeded = (fails < inGameInfo.numFailsRequired());
  const spiesWin = missionsFailed >= 2 && !thisMissionSucceeded;
  const assassinationPhase = missionsSucceeded >= 2 && thisMissionSucceeded;

  const newGamePhase =
      spiesWin ? "spiesWin" :
      (assassinationPhase ? "assassinationPhase" :
                            "inProgress");                

  return {
    succeeded: thisMissionSucceeded,
    numSuccesses: successes,
    numFails: fails,
    playerIdsOnMission: inGameInfo.selectedOnMission,
    newPhase: newGamePhase,
    nextProposerId: calculateNextProposer(inGameInfo),
  };
};


export const InGameInfoHooks = {
  beforeInsertInfo(inGameInfo) {
    // Add voting info to players. These keeps all voting info managed inside
    // of InGameInfo.
    inGameInfo.playersInGame = inGameInfo.playersInGame.map(function(player) {
      player.voteHistoryId = VoteHistory.insert({missions: [[]]});
      return player;
    });
    return inGameInfo;
  },

  afterUpdateInfo(selector, modifier) {
    if (_.has(modifier, "$addToSet") && _.has(modifier.$addToSet, "liveVoteTally")) {
      // Use the same selector for the `update` call to find the updated vote tally.
      const updatedInfo = InGameInfo.findOne(selector);
      if (updatedInfo.liveVoteTally.length >= updatedInfo.playersInGame.length) {
        const updates = calculateConditionalProposalUpdates(updatedInfo);
        copyVoteTallyInfoToPersonalHistory(updatedInfo);
        // Note that this call will also call into `afterUpdateInfo` but the
        // modifier won't match.
        InGameInfo.update(selector, { 
          $set: {
            proposalVoteInProgress: false,  // everyone voted, so we're done.
            liveVoteTally: [/*cleared*/],
          },
        });

        if (updates.proposalPassed) {
          InGameInfo.update(selector, { $set: { missionInProgress: true } });
        } else if (updates.rejectedFifth) {
          InGameInfo.update(selector, { $set: { gamePhase: "spiesWin" } });
        } else {
          // Proposal passes on to the next person...
          InGameInfo.update(selector, {
            $inc: { currentProposalNumber: 1 },
            $set: { 
              proposer: updates.nextProposerId,
              selectedOnMission: [/*cleared*/],
            },
          });
        }
      }
    } else if (_.has(modifier, "$addToSet") && _.has(modifier.$addToSet, "liveMissionTally")) {
      // Use the same selector for the `update` call to find the updated vote tally.
      const updatedInfo = InGameInfo.findOne(selector);
      if (updatedInfo.liveMissionTally.length >= updatedInfo.numShouldBeOnProposal()) {
        const updates = calculateConditionalMissionUpdates(updatedInfo);
        const missionOutcomeUpdate = {
          succeeded: updates.succeeded,
          successes: updates.numSuccesses,
          fails: updates.numFails,
          playerIdsOnMission: updates.playerIdsOnMission,
        };

        // Always update these, whether the game is over or not.
        InGameInfo.update(selector, {
          $push: { missionOutcomes: missionOutcomeUpdate},
          $set: {
            selectedOnMission: [/*cleared*/],
            missionInProgress: false,
            liveMissionTally: [/*cleared*/],
            gamePhase: updates.newPhase,
          },
        });

        if (updates.newPhase === "inProgress") {
          InGameInfo.update(selector, {
            $inc: { currentMissionNumber: 1 },
            // Note that this set should also trigger the branch below to
            // update VoteHistory as need be...
            $set: {
              currentProposalNumber: 1,
              proposer: updates.nextProposerId,
            },
          });
        }
      }
    } else if (_.has(modifier, "$set") &&
               _.has(modifier.$set, "currentProposalNumber") &&
               modifier.$set.currentProposalNumber === 1) {
      const updatedInfo = InGameInfo.findOne(selector);
      // Note: the assumption here is that whenever the proposal number is set
      // to 1, we need to create a "mission" array for VoteHistory...
      // Note: when the game is created, `beforeInsertInfo` handles creating
      // the first empty "mission" array.
      updatedInfo.playersInGame.map(function(player) {
        VoteHistory.update({_id: player.voteHistoryId}, {
          $push: {missions: []}, 
        });
      });
    }
  },

  afterRemoveInfos(inGameInfos) {
    inGameInfos.forEach(function(inGameInfo) {
      const voteHistoryIds =
          inGameInfo.playersInGame.map(player => player.voteHistoryId);
      VoteHistory.remove({_id: { $in: voteHistoryIds}});
    });
  },
};
