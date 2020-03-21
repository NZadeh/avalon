import { Mongo } from 'meteor/mongo';
import SimpleSchema from 'simpl-schema';

import { InGameInfoHooks } from '/imports/collections/game_rooms/hooks.js';

class InGameInfoCollection extends Mongo.Collection {
  insert(inGameInfo, callback) {
    const updatedInfo = InGameInfoHooks.beforeInsertInfo(inGameInfo);
    return super.insert(updatedInfo, callback);
  }

  update(selector, modifier) {
    const result = super.update(selector, modifier);
    InGameInfoHooks.afterUpdateInfo(selector, modifier);
    return result;
  }

  remove(selector, callback) {
    const info = this.find(selector).fetch();
    const result = super.remove(selector, callback);
    InGameInfoHooks.afterRemoveInfo(info);
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


  // TODO(neemazad): Maybe consider breaking this out into its own
  // Collection...? Will make updates to it more efficient, I think.
  missionOutcomes: {
    type: Array,
    minCount: 0,  // Start the game with 0 missions.
    maxCount: 5,  // End with 5...
  },
  'missionOutcomes.$': Object,
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

  winner: {
    type: String,
    allowedValues: ['undecided', 'resistance', 'spies'],
  },
});

InGameInfo.attachSchema(InGameInfo.schema);

// See https://guide.meteor.com/collections.html#collection-helpers for info.
InGameInfo.helpers({
  voteHistoryId(playerId) {
    const found = this.playersInGame.find(function(player) {
      return player._id == playerId;
    });
    return found.voteHistoryId;
  },

  voteHistory(playerId) {
    const voteId = voteHistoryId(playerId);
    if (!voteId) return voteId;  // Pass through garbage.
    return VoteHistory.findOne({_id: voteId});
  },

  allPlayerVoteHistory() {
    const voteHistoryIds =
        this.playersInGame.map(player => player.voteHistoryId);
    return VoteHistory.findOne({_id: {$in: voteHistoryIds}});
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
  'missions.$.$': Boolean  // True: Success, False: Fail
});
