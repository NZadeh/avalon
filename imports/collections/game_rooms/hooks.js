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

const calculateConditionalUpdates = function(inGameInfo) {
  var approves = 0;
  var rejects = 0;
  inGameInfo.liveVoteTally.forEach(function(talliedVote) {
    if (talliedVote.vote) {
      ++approves;
    } else {
      ++rejects;
    }
  });
  // To be returned.
  const passed = approves > rejects;
  // To be returned.
  const isFifth = inGameInfo.currentProposalNumber == 5;

  // Calculate next proposer.
  const players = inGameInfo.playersInGame;
  const proposingIndex = players.findIndex(function(player) {
    return player._id == inGameInfo.proposer;
  });
  console.assert(0 <= proposingIndex && proposingIndex < players.length,
                 "Unable to find current proposer when moving to next proposal...");
  const nextIndex = (proposingIndex + 1) % players.length;

  return {
    proposalPassed: passed,
    rejectedFifth: (!passed && isFifth),
    nextProposerId: players[nextIndex]._id,
  };
};

const copyVoteTallyInfoToPersonalHistory = function(voteTally) {
  voteTally.forEach(function(singleVote) {
    const playerId = singleVote.playerId;
    const vote = singleVote.vote;

    const voteHistory = InGameInfo.voteHistory(playerId);
    console.assert(!!voteHistory, "Could not find valid vote history.");

    // TODO(neemazad): if $push approach doesn't work, try this code instead.
    // var updatedMissions = voteHistory.missions;
    // updatedMissions[updatedMissions.length - 1].push(vote);
    // VoteHistory.update({_id: InGameInfo.voteHistoryId(playerId)},
    //     {$set: { missions: updatedMissions }});
    const missionIndexToUpdate = voteHistory.missions.length - 1;
    VoteHistory.update({_id: InGameInfo.voteHistoryId(playerId)},
          {$push: { ("missions." + missionIndexToUpdate): vote }});
  });
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
        const updates = calculateConditionalUpdates(updatedInfo);
        copyVoteTallyInfoToPersonalHistory(updatedInfo.liveVoteTally);
        // Note that this call will also call into `afterUpdateInfo` but the
        // modifier won't match.
        InGameInfo.update(selector, { 
          $set: {
            selectedOnMission: [/*cleared*/],
            proposalVoteInProgress: false,  // everyone voted, so we're done.
            liveVoteTally: [/*cleared*/],
          },
        });

        if (updates.proposalPassed) {
          InGameInfo.update(selector, { $set: { missionInProgress: true } });
        } else if (updates.rejectedFifth) {
          InGameInfo.update(selector, { $set: { winner: "spies" } });
        } else {
          // Proposal passes on to the next person...
          // TODO(neemazad): Need to confirm that we can actually use two modifiers like this...
          InGameInfo.update(selector, {
            $inc: { currentProposalNumber: 1 },
            $set: { proposer: updates.nextProposerId },
          });
        }
      }
    }
  },

  afterRemoveInfo(inGameInfo) {
    const voteHistoryIds =
        inGameInfo.playersInGame.map(player => player.voteHistoryId);
    VoteHistory.remove({_id: { $in: voteHistoryIds}});
  },
};
