import { Meteor } from 'meteor/meteor';
import { _ } from 'meteor/underscore';

import { HelperConstants } from '/imports/collections/game_rooms/constants';
import { GameRooms } from '/imports/collections/game_rooms/game_rooms';
import { InGameInfo, VoteHistory } from '/imports/collections/game_rooms/in_game_info.js';
import { SecretInfo, secretInfoUniqueId, secretInfoUniqueIdToPlayerId }
                            from '/imports/collections/game_rooms/secret_info';

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
  },
  HelperConstants.emptyOptions,
  HelperConstants.makeAsyncCallback);
};

const playerRejoins = function(playerId, roomId) {
  addPlayerRoomInfo(playerId, roomId);
  removePreviousRoomInfo(playerId, roomId);
};

const markPlayerAsRemovedFromRoom = function(playerId, roomId, markAsPrev) {
  // It is possible that while the room is being destroyed,
  // a player has already left and is in another room. (Their
  // current room is not the roomId they're being removed from.)
  // If that's the case, we want to avoid overriding their
  // room.
  const removed = Meteor.users.findOne(
      { _id: playerId },
      { fields: {currentGameRoomId: 1} }
  );
  if (removed && removed.currentGameRoomId === roomId) {
    setPlayerInRoom(playerId, HelperConstants.kNoRoomId);
  }
  if (markAsPrev) {
    setPlayerPrevRoom(playerId, roomId);
  }
};

const removePlayerRoomInfoForGood = function(playerId, roomId) {
  markPlayerAsRemovedFromRoom(playerId, roomId, /*markAsPrev=*/false);
  // This room no longer is viable for a player to re-join.
  removePreviousRoomInfo(playerId, roomId);
  // Deletes if present.
  SecretInfo.remove({ uniqueId: secretInfoUniqueId(playerId, roomId) },
                    HelperConstants.makeAsyncCallback);
};

// TODO(neemazad): Move this into SecretInfo / ServerSecrets / somewhere more generic?
const playerIdsOfRole = function(roomId, roleName) {
  const roleCursor = SecretInfo.find(
    { 
      roleName: { $regex: `${roleName}` },
      uniqueId: { $regex: `${roomId}` },
    },
    { fields: { uniqueId: 1 } },
  );

  return roleCursor.map(secretInfo => {
    return secretInfoUniqueIdToPlayerId(secretInfo.uniqueId);
  });
}

// TODO(neemazad): Move this into SecretInfo / ServerSecrets / somewhere more generic?
const getPlayersAndRoles = function(roomId, inGameInfoId, roleNameFilter) {
  const inGameInfo = InGameInfo.findOne(
    { _id: inGameInfoId },
    { fields: { playersInGame: 1 } }
  );
  if (!inGameInfo) return;

  const secretInfoIds = inGameInfo.playersInGame.map(
      player => secretInfoUniqueId(player._id, roomId));

  const maybeFilterName = function(roleNameFilter) {
    if (!roleNameFilter || roleNameFilter.length <= 0) return {};
    const regexArr = roleNameFilter.map(name => new RegExp(`${name}`));
    return { roleName: { $in: regexArr } };
  };

  const roleCursor = SecretInfo.find(
    {
      uniqueId: { $in: secretInfoIds },
      ...maybeFilterName(roleNameFilter),  // optional struct (unpacked)
    },
    { fields: { uniqueId: 1, roleName: 1 } },
  );
  
  return roleCursor.map(secretInfo => ({
    playerId: secretInfoUniqueIdToPlayerId(secretInfo.uniqueId),
    role: secretInfo.roleName,
  }));
}

const revealRolesInRoom = function(roomId, inGameInfoId, roleNameFilter) {
  const playerIdsWithRole = getPlayersAndRoles(
      roomId, inGameInfoId, roleNameFilter);
  
  playerIdsWithRole.forEach( ({playerId, role}) => {
    InGameInfo.update(
      { 
        _id: inGameInfoId,
        "playersInGame._id": playerId
      },
      {
        $set: {
          "playersInGame.$.roleIfRevealed": role
        }
      },
    );
  });
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
      const room = GameRooms.findOne(
          selector,
          { fields: { open: 1 } },
      );
      if (room.open) {
        // Continue with the removal as planned.
        return true;
      }

      const roomId = room._id;
      // Otherwise, we mark the player as absent and clean up later.
      // NOTE: see the branch in `afterUpdateRoom` that cleans up
      // once the room opens up again.
      GameRooms.update(
        {
          _id: roomId,
          players: { $elemMatch: { _id: playerId } },
        },
        { $set: { "players.$.gone": true } }
      );
      markPlayerAsRemovedFromRoom(playerId, roomId, /*markAsPrev=*/true);

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
        const room = GameRooms.findOne(
            {_id: roomId},
            { fields: { players: 1 } },
        );

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
  const isFifth = inGameInfo.currentProposalNumber >= 5;
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

    const voteHistory = VoteHistory.findOne(
        { _id: voteHistoryId },
        { fields: { missions: 1 } },
    );
    console.assert(!!voteHistory, "Could not find valid vote history.");

    const missionIndexToUpdate = voteHistory.missions.length - 1;
    // Build up the update from scratch, so that we can use MongoDB
    // dot notation to access the correct array index in missions.
    // { $push: { `missions.${missionIndexToUpdate}` : voteUpdate} }
    var update = { $push: {} };
    update.$push[`missions.${missionIndexToUpdate}`] = voteUpdate;
    VoteHistory.update({_id: voteHistoryId},
                       update,
                       HelperConstants.emptyOptions,
                       HelperConstants.makeAsyncCallback);
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
      spiesWin ? HelperConstants.kPhaseSpiesFail :
      (assassinationPhase ? HelperConstants.kPhaseAssassination :
                            HelperConstants.kPhaseProposal);

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

  afterUpdateInfo(selector, modifier, preUpdateData) {
    if (_.has(modifier, "$addToSet") &&
        _.has(modifier.$addToSet, "liveVoteTally")) {
      // Use the same selector for the `update` call to find the updated
      // proposal vote tally.
      const updatedInfo = InGameInfo.findOne(
          selector,
          // Most fields are needed, but missionOutcomes is a rather large
          // object that we don't need at all here.
          { fields: { missionOutcomes: 0 } },
      );
      if (updatedInfo.liveVoteTally.length >= updatedInfo.playersInGame.length) {
        const updates = calculateConditionalProposalUpdates(updatedInfo);
        copyVoteTallyInfoToPersonalHistory(updatedInfo);
        // Note that this call will also call into `afterUpdateInfo` but the
        // modifier won't match.
        InGameInfo.update(selector, { 
          $set: {
            liveVoteTally: [/*cleared*/],
          },
        });

        if (updates.proposalPassed) {
          InGameInfo.update(selector, { $set: { gamePhase: HelperConstants.kPhaseMission } });
        } else if (updates.rejectedFifth) {
          InGameInfo.update(selector, { $set: { gamePhase: HelperConstants.kPhaseSpiesFail } });
        } else {
          // Proposal passes on to the next person...
          // NOTE: this is a non-idempotent operation -- we need to make sure
          // that the document being updated matches the expected criteria to
          // avoid a race condition where we run the operation twice.
          // (The `update` itself is guaranteed atomic by MongoDB).
          //
          // NOTE: for this operation, we know we are updating only a single
          // InGameInfo, so we grab the first (and only) preUpdateData.
          InGameInfo.update(
            {
              ...selector,
              ...{ currentProposalNumber: preUpdateData[0].proposalNum },
            },
            {
              $inc: { currentProposalNumber: 1 },
              $set: {
                proposer: updates.nextProposerId,
                selectedOnMission: [/*cleared*/],
                gamePhase: HelperConstants.kPhaseProposal,
              },
            }
          );
        }
      }
    } else if (_.has(modifier, "$addToSet") &&
               _.has(modifier.$addToSet, "liveMissionTally")) {
      // Use the same selector for the `update` call to find the updated
      // mission vote tally.
      // Note that most large fields are needed here, so we cannot limit the fields.
      const updatedInfo = InGameInfo.findOne(selector);
      if (updatedInfo.liveMissionTally.length >= updatedInfo.numShouldBeOnProposal()) {
        const updates = calculateConditionalMissionUpdates(updatedInfo);
        const missionOutcomeUpdate = {
          succeeded: updates.succeeded,
          successes: updates.numSuccesses,
          fails: updates.numFails,
          playerIdsOnMission: updates.playerIdsOnMission,
        };
        const playersInGame = updatedInfo.playersInGame;

        // NOTE: all operations below this line are non-idempotent -- we need
        // to make sure that the document being updated matches the expected
        // criteria to avoid a race condition where we run the operation twice.
        // (The `update` itself is guaranteed atomic by MongoDB).

        // Always update these, whether the game is over or not.
        InGameInfo.update(
          {
            ...selector,
            ...{ gamePhase: HelperConstants.kPhaseMission },
          },
          {
            $push: { missionOutcomes: missionOutcomeUpdate},
            $set: {
              selectedOnMission: [/*cleared*/],
              liveMissionTally: [/*cleared*/],
              gamePhase: updates.newPhase,
            },
          }
        );

        if (updates.newPhase === HelperConstants.kPhaseProposal) {
          // NOTE: for this operation, we know we are updating only a single
          // InGameInfo, so we grab the first (and only) preUpdateData.
          const numMatched = InGameInfo.update(
            {
              ...selector,
              ...{ currentMissionNumber: preUpdateData[0].missionNum },
            },
            {
              $inc: { currentMissionNumber: 1 },
              $set: {
                currentProposalNumber: 1,
                proposer: updates.nextProposerId,
              },
            }
          );
          
          // RACE CONDITION!
          //
          // numMatched > 0 implies that the update selector found the
          // InGameInfo to update, with the correct mission number.
          //
          // numMatched === 0 implies that the update selector did not find
          // any docs, which implies that a previous run of the code already
          // incremented the mission number.
          //
          // In the latter case, we prevent a duplicate-run of this code with
          // this matched-check.
          if (numMatched > 0) {
            // Prepare the vote history for the new mission.
            playersInGame.forEach(player => {
              VoteHistory.update({_id: player.voteHistoryId},
                                 { $push: {missions: []} },
                                 HelperConstants.emptyOptions,
                                 HelperConstants.makeAsyncCallback);
            });
          }
        }
      }
    } else if (_.has(modifier, "$set") && _.has(modifier.$set, "gamePhase")) {
      // Hope that the selector has the room id...
      // We can't rely on the selector finding a room, necessarily, since
      // the room may have since been updated not to match the selector.
      // (e.g. the gamePhase was specified in the selector, changed, and then
      // this code is being called).
      //
      // If we start updating based on not the id, this code needs to change.
      check(selector._id, String);
      const inGameInfoId = selector._id;
      const game = InGameInfo.findOne(
          { _id: inGameInfoId },
          { fields: {gameRoomId: 1, gamePhase: 1} },
      );
      const roomId = game.gameRoomId;
      const newPhase = game.gamePhase;

      if (newPhase === HelperConstants.kPhaseResolveAssassination || game.isGameOverState()) {
        revealRolesInRoom(roomId, inGameInfoId);
      }

      if (newPhase === HelperConstants.kPhaseAssassination) {
        revealRolesInRoom(roomId, inGameInfoId, [HelperConstants.kAssassin]);
      } else if (newPhase === HelperConstants.kPhaseResolveAssassination) {
        // Get a fresh copy here since we've just revealed everything.
        const selected = InGameInfo.findOne(
            { _id: inGameInfoId },
            { fields: {selectedForAssassination: 1} },
        ).selectedForAssassination;

        // We expect that this phase was set after due-diligence checking of
        // the conditions for assassination (c.f. `finalizeAssassination`).
        const targetId = selected[0];
        const merlinId = playerIdsOfRole(roomId, HelperConstants.kMerlin)[0];

        // Note that to keep the Assassination-animation after the game phase
        // changes, we do *not* clear the selectedForAssassination list.
        if (targetId === merlinId) {
          InGameInfo.update({_id: inGameInfoId},
            { $set: { gamePhase: HelperConstants.kPhaseAssassinated }}
          );
        } else {
          InGameInfo.update({_id: inGameInfoId},
            { $set: { gamePhase: HelperConstants.kPhaseResistanceWin }}
          );
        }
      }
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
