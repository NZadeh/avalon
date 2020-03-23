import { Meteor } from 'meteor/meteor';
import { _ } from 'meteor/underscore';

import { HelperConstants } from '/imports/collections/game_rooms/constants';
import { SecretInfo } from '/imports/collections/game_rooms/secret_info';
import { InGameInfo, VoteHistory } from '/imports/collections/game_rooms/in_game_info.js';

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
  afterInsertRoom(room, newRoomId) {
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
    const vote = singleVote.vote;
    const voteHistoryId = map.get(playerId);

    const voteHistory = VoteHistory.findOne({_id: voteHistoryId});
    console.assert(!!voteHistory, "Could not find valid vote history.");

    const missionIndexToUpdate = voteHistory.missions.length - 1;
    // Build up the update from scratch, so that we can use MongoDB
    // dot notation to access the correct array index in missions.
    // { $push: { `missions.${missionIndexToUpdate}` : vote} }
    var update = { $push: {} };
    update.$push[`missions.${missionIndexToUpdate}`] = vote;
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
          // TODO(neemazad): Probably clear a bunch of data here too?
          // Freeze update-ability etc.
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
