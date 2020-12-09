import { Mongo } from 'meteor/mongo';
import SimpleSchema from 'simpl-schema';

import { HelperConstants } from '/imports/collections/game_rooms/constants';
import { HelperMethods } from '/imports/collections/game_rooms/methods_helper';
import { InGameInfoHooks } from '/imports/collections/game_rooms/hooks.js';

// Returns an array of some attributes of the InGameInfo objects that can be
// added to the query selector to make sure that, if the database is updated
// by another thread/client in the interim, the query will no longer match and
// will *not* duplicate a non-idempotent operation.
const raceConditionPrevention = function(inGameInfos) {
  return inGameInfos.map(info => ({
    proposalNum: info.currentProposalNumber,
    missionNum: info.currentMissionNumber,
  }));
};

class InGameInfoCollection extends Mongo.Collection {
  insert(inGameInfo, callback) {
    const updatedInfo = InGameInfoHooks.beforeInsertInfo(inGameInfo);
    return super.insert(updatedInfo, callback);
  }

  update(selector, modifier) {
    const infos = this.find(selector).fetch();
    const preUpdateData = raceConditionPrevention(infos);
    const result = super.update(selector, modifier);
    InGameInfoHooks.afterUpdateInfo(selector, modifier, preUpdateData);
    return result;
  }

  remove(selector, callback) {
    const infos = this.find(selector).fetch();
    const result = super.remove(selector, callback);
    InGameInfoHooks.afterRemoveInfos(infos);
    return result;
  }
}

export const InGameInfo = new InGameInfoCollection('InGameInfo');

// Deny all client-side updates since we will be using methods to manage this collection
InGameInfo.deny({
  insert() { return true; },
  update() { return true; },
  remove() { return true; },
});

InGameInfo.schema = new SimpleSchema({
  _id: {
    type: String,
    regEx: SimpleSchema.RegEx.Id,
  },
  gameRoomId: {
    type: String,
    regEx: SimpleSchema.RegEx.Id,
  },

  // Note that the order here, as opposed to in GameRooms, is what dicatates
  // the seating order.
  playersInGame: {
    type: Array,
    minCount: 1,
    maxCount: 10,
  },
  'playersInGame.$': Object,
  'playersInGame.$._id': {
    type: String,
    regEx: SimpleSchema.RegEx.Id,
  },
  'playersInGame.$.voteHistoryId': {
    type: String,
    regEx: SimpleSchema.RegEx.Id,
  },
  'playersInGame.$.roleIfRevealed': {
    optional: true,
    type: String,
    allowedValues: HelperConstants.kAllowedRoleNames,
  },
  
  missionCounts: {
    type: Array,
    minCount: 5,
    maxCount: 5,
  },
  'missionCounts.$': {
    type: SimpleSchema.Integer,
    min: 2,
    max: 5,
  },

  currentMissionNumber: {
    type: SimpleSchema.Integer,
    min: 1,
    max: 5,
  },
  currentProposalNumber: {
    type: SimpleSchema.Integer,
    min: 1,
    max: 5,
  },
  proposer: {
    // Should be one of `playersInGame`...
    // Could use https://github.com/aldeed/simple-schema-js#custom-field-validation
    type: String,
    regEx: SimpleSchema.RegEx.Id,
  },

  selectedOnMission: {
    type: Array,
  },
  'selectedOnMission.$': {
    // should be a subset of playersInGame ids.
    type: String,
    regEx: SimpleSchema.RegEx.Id,
  },

  selectedForAssassination: {
    type: Array,
  },
  'selectedForAssassination.$': {
    // should be a subset of playersInGame ids.
    type: String,
    regEx: SimpleSchema.RegEx.Id,
  },

  // Cleared after each round when written to individual player history.
  // Used to determine when voting is done...
  // TODO(neemazad): Hide the votes field in the subscription, somehow.
  // I think that means either storing a copy of who voted (but not what)
  // in a different field and blocking out this field, or possibly hiding
  // the actual vote behind an ID...
  liveVoteTally: {
    type: Array,
    minCount: 0,
    maxCount: 10,
  },
  'liveVoteTally.$': Object,
  'liveVoteTally.$.playerId': {
    type: String,
    regEx: SimpleSchema.RegEx.Id,
  },
  'liveVoteTally.$.vote': Boolean,

  // Cleared after each mission when written to history.
  // Used to determine when succeeding/failing is done...
  // TODO(neemazad): Hide the votes field in the subscription, somehow.
  // Since we don't need to attribute the vote back to the player, it
  // might be possible to separate out the vote into its own array field
  // and block that array from being returned.
  liveMissionTally: {
    type: Array,
    minCount: 0,
    maxCount: 5,
  },
  'liveMissionTally.$': Object,
  'liveMissionTally.$.playerId': {
    type: String,
    regEx: SimpleSchema.RegEx.Id,
  },
  'liveMissionTally.$.vote': Boolean,


  missionOutcomes: {
    type: Array,
    minCount: 0,  // Start the game with 0 missions.
    maxCount: 5,  // End with 5...
  },
  'missionOutcomes.$': Object,
  'missionOutcomes.$.succeeded': Boolean,
  'missionOutcomes.$.successes': SimpleSchema.Integer,
  'missionOutcomes.$.fails': SimpleSchema.Integer,
  'missionOutcomes.$.playerIdsOnMission': {
    type: Array,
    minCount: 2,
    maxCount: 5,
  },
  'missionOutcomes.$.playerIdsOnMission.$': {
    // should be a subset of playersInGame ids.
    type: String,
    regEx: SimpleSchema.RegEx.Id,
  },

  // TODO(neemazad): Make these "enum values" constants. Replace string
  // literals everywhere with those constants.
  gamePhase: {
    type: String,
    allowedValues: [
      'proposalInProgress',
      'proposalVoteInProgress',
      'missionInProgress',
      'spiesWinOnFails',
      'assassinationPhase',
      'resolveAssassination',  // internal-only phase
      'spiesWinInAssassination',
      'resistanceWin',
    ],
  },
});

InGameInfo.attachSchema(InGameInfo.schema);

// Returns arrayA - arrayB.
const setDifference = function(arrayA, arrayB) {
  return arrayA.filter(elem => !arrayB.includes(elem));
};

const assassinIdOrUndefined = function(inGameInfo) {
  const maybeAssassin =
      inGameInfo.playersInGame.find(
          player => player.roleIfRevealed === HelperConstants.kAssassin);

  if (!maybeAssassin) return undefined;
  return maybeAssassin._id;
};

// See https://guide.meteor.com/collections.html#collection-helpers for info.
InGameInfo.helpers({
  playerIdToVoteHistoryIdMap() {
    var map = new Map();
    this.playersInGame.forEach(player => map.set(player._id, player.voteHistoryId));
    return map;
  },

  allPlayerVoteHistoryCursor() {
    const voteHistoryIds =
        this.playersInGame.map(player => player.voteHistoryId);
    return VoteHistory.find({_id: {$in: voteHistoryIds}});
  },

  playersNeedingToAct() {
    if (this.gamePhase === "proposalInProgress") {
      return [this.proposer]; // Array with one-element.
    } else if (this.gamePhase === "proposalVoteInProgress") {
      // If the vote is in progress, this should be everyone in the room
      // minus folks who have voted in liveVoteTally.
      return setDifference(
          this.playersInGame.map(player => player._id),
          this.liveVoteTally.map(talliedVote => talliedVote.playerId));
    } else if (this.gamePhase === "missionInProgress") {
      // If the mission is in progress, this should be everyone selected
      // on mission minus the folks who have voted in liveMissionTally.
      return setDifference(
          this.selectedOnMission,
          this.liveMissionTally.map(talliedVote => talliedVote.playerId));
    } else if (this.gamePhase === "assassinationPhase") {
      // We shouldn't return "undefined" from this function.
      // Replace with the proposer id as a default if Assassin isn't
      // yet revealed on a client (until that client catches up).
      maybeId = assassinIdOrUndefined(this);
      if (!maybeId) maybeId = this.proposer;
      return [maybeId]; // Array with one element.
    }

    // The game is over.
    return [/*no-one*/];
  },

  numShouldBeOnProposal() {
    return this.missionCounts[this.currentMissionNumber - 1];
  },

  numCurrentlyOnProposal() {
    return this.selectedOnMission.length;
  },

  numCurrentlyOnAssassinationList() {
    return this.selectedForAssassination.length;
  },

  numFailsRequired() {
    return HelperMethods.numFailsRequired(
        this.playersInGame.length,
        this.currentMissionNumber);
  },

  // ASSUMPTION: The player order in the database is the player order for
  // the game.
  seatingOrderMap() {
    var ordering = new Map();
    var seatingPosition = 0;
    this.playersInGame.map(function(player) {
      ordering.set(player._id, seatingPosition++);
    });
    return ordering;
  },  

  // Returns an array of { id: playerId, proposalNum : proposalNumber }
  // objects, where the playerIds belong to the players who are
  // proposing/might still propose for this current mission.
  //
  // ASSUMPTION: The player order in the database is the player order for
  // the game. (Matches `seatingOrderMap()`'s logic)
  remainingProposersForMission() {
    // Assumption is that player order in `this` is the ground truth for
    // player order.
    const players = this.playersInGame;
    const currProposerIndex = players.findIndex(
        player => player._id == this.proposer);

    var ids = [];
    for (let i = currProposerIndex;
         (i <= currProposerIndex + 5 - this.currentProposalNumber) &&
         (i < currProposerIndex + players.length);
         ++i) {
      let proposer = players[i % players.length];
      let proposalNumber = this.currentProposalNumber + ids.length;

      ids.push({ id: proposer._id, proposalNum: proposalNumber });
    }
    return ids;
  },

  missionSuccessFailCounts() {
    var numSuccesses = 0;
    var numFails = 0;
    this.missionOutcomes.forEach(function(outcome) {
      if (outcome.succeeded) {
        ++numSuccesses;
      } else {
        ++numFails;
      }
    });

    return [numSuccesses, numFails];
  },

  isGameOverState() {
    return ["spiesWinOnFails",
            "spiesWinInAssassination",
            "resistanceWin"].includes(this.gamePhase);
  },

  isKnownAssassin(playerId) {
    return assassinIdOrUndefined(this) === playerId;
  },
});

// Vote history -- referenced and managed exclusively via InGameInfo.
class VoteHistoryCollection extends Mongo.Collection {}

export const VoteHistory = new VoteHistoryCollection('VoteHistory');

// Deny all client-side updates since we will be using methods to manage this collection
VoteHistory.deny({
  insert() { return true; },
  update() { return true; },
  remove() { return true; },
});

VoteHistory.schema = new SimpleSchema({
  // The ID is expected to be attached to the player in InGameInfo.
  // As a result, we do not explicitly track which player's vote
  // history this is here, though maybe we could?
  _id: {
    type: String,
    regEx: SimpleSchema.RegEx.Id,
  },
  missions: {
    type: Array,
    minCount: 0,  // Start the game with 0 missions.
    maxCount: 5,  // End with 5...
  },
  'missions.$': {
    // Votes for each proposal for the given mission (at index)
    type: Array,
    minCount: 0,  // Start with no proposals on a mission
    maxCount: 5,  // Up to the 5th
  },
  'missions.$.$': Object,
  'missions.$.$.vote': Boolean, // True: Success, False: Fail
  'missions.$.$.wasProposer': Boolean,
  'missions.$.$.wasOnProposal': Boolean,
});
