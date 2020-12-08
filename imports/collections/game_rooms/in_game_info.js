import { Mongo } from 'meteor/mongo';
import SimpleSchema from 'simpl-schema';

import { HelperMethods } from '/imports/collections/game_rooms/methods_helper';
import { InGameInfoHooks } from '/imports/collections/game_rooms/hooks.js';

class InGameInfoCollection extends Mongo.Collection {
  insert(inGameInfo, callback) {
    const updatedInfo = InGameInfoHooks.beforeInsertInfo(inGameInfo);
    return super.insert(updatedInfo, callback);
  }

  update(selector, modifier) {
    // TODO(neemazad): Can we atomically check the update hook condition here?
    // Or add a reveal button when everyone has voted to bring a slow human
    // into the loop after the client sees everyone has voted on a proposal
    // or put in their mission success/fails...
    // (Otherwise, there is a race condition where we might update proposal
    // or mission progress twice.)
    const result = super.update(selector, modifier);
    InGameInfoHooks.afterUpdateInfo(selector, modifier);
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
    minCount: 0,  // A proposal starts empty...
    maxCount: 5,  // and can contain up to 5.
  },
  'selectedOnMission.$': {
    // should be a subset of playersInGame ids.
    type: String,
    regEx: SimpleSchema.RegEx.Id,
  },

  // True iff a proposal has been finalized and everyone is in the process
  // of voting approve/reject.
  proposalVoteInProgress: Boolean,
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

  // True iff a proposal got the necessary votes (approves > rejects),
  // and we are still waiting for on-mission people to play success/fail.
  missionInProgress: Boolean,
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

  // TODO(neemazad): Collapse mission/vote in progress into this "enum"
  gamePhase: {
    type: String,
    allowedValues: [
      'inProgress',
      'spiesWin',
      'assassinationPhase',
      'resistanceWin',
    ],
  },
});

InGameInfo.attachSchema(InGameInfo.schema);

// Returns arrayA - arrayB.
const setDifference = function(arrayA, arrayB) {
  return arrayA.filter(elem => !arrayB.includes(elem));
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
    if (this.proposalVoteInProgress) {
      // If the vote is in progress, this should be everyone in the room
      // minus folks who have voted in liveVoteTally.
      return setDifference(
          this.playersInGame.map(player => player._id),
          this.liveVoteTally.map(talliedVote => talliedVote.playerId));
    } else if (this.missionInProgress) {
      // If the mission is in progress, this should be everyone selected
      // on mission minus the folks who have voted in liveMissionTally.
      return setDifference(
          this.selectedOnMission,
          this.liveMissionTally.map(talliedVote => talliedVote.playerId));
    } else {
      // No vote and no mission means the proposer needs to act.
      return [this.proposer]; // Array with one-element.
    }
  },

  numShouldBeOnProposal() {
    return this.missionCounts[this.currentMissionNumber - 1];
  },

  numCurrentlyOnProposal() {
    return this.selectedOnMission.length;
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
    return ['spiesWin', 'assassinationPhase', 'resistanceWin'].includes(
               this.gamePhase);
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
