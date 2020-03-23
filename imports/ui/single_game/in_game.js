import './in_game.html';

import { GameRooms } from '/imports/collections/game_rooms/game_rooms';
import { HelperConstants } from '/imports/collections/game_rooms/constants';
import { Callbacks } from '/imports/utils/callbacks';

import {
  removeSelf,
  backToLobby,
  toggleOnProposal,
  finalizeProposal,
  voteOnProposal,
  voteOnMission,
} from '/imports/collections/game_rooms/methods';

import '/imports/ui/common/button.js';
import '/imports/ui/common/modal.js';
import '/imports/ui/common/yes_no_vote.js';

// Anonymous helper! Assumes all arrays have at least one value.
const lastElemOfLastArray = function(nestedArray) {
  const lastArray = nestedArray[nestedArray.length - 1];
  return lastArray[lastArray.length - 1];
};

// Anonymous helper to create ["1.1", "1.2", ..., "3.4"].
const deduceNecessaryHeaders = function(voteHistory) {
  var headers = [];
  var mission = 1;
  voteHistory.forEach(function(proposalVotes) {
    for (let proposalNum = 1; proposalNum <= proposalVotes.length; ++proposalNum) {
      headers.push(`${mission}.${proposalNum}`);
    }
    mission++;
  });
  return headers;
};

const flatten = function(nestedArray) {
  function flattenHelper(nestedArray, output) {
    // Base case
    if (!(nestedArray instanceof Array)) {
      output.push(nestedArray);
      return;
    }
    // Still unnesting
    nestedArray.forEach(function(maybeNestedArray) {
      flattenHelper(maybeNestedArray, output);
    });
  };

  var flattened = [];
  flattenHelper(nestedArray, flattened);
  return flattened;
};

Template.inGame.helpers({
  numRequiredOnMission: function() {
    return this.inGameInfo.numShouldBeOnProposal();
  },

  conditionallyDisabled: function(existingClasses) {
    return existingClasses +
        (this.inGameInfo.numCurrentlyOnProposal() === 
         this.inGameInfo.numShouldBeOnProposal() ?
            "" :
            " disabled");
  },

  numFailsRequired: function() {
    const number = this.inGameInfo.numFailsRequired();
    const plural = number != 1 ? "s" : "";
    return `${number} fail${plural}`;
  },

  previousMissionOutcomes: function() {
    return this.inGameInfo.missionOutcomes.map(outcome => outcome.succeeded);
  },

  isGameOver: function() {
    return this.inGameInfo.isGameOverState();
  },

  gameStateText: function() {
    const phase = this.inGameInfo.gamePhase;
    if (phase === 'spiesWin') return "Spies win on fails.";
    if (phase === 'assassinationPhase') return "Assassin reveal; Spies find Merlin.";
    if (phase === 'resistanceWin') return "Resistance win with Merlin hidden.";
    return "Game in progress..."; // Unused...
  },

  playersList: function() {
    const capturedThis = this;

    const cellBackgroundColor = function(onProposal, renderingSelf) {
      if (onProposal) return "green lighten-4";
      return "grey lighten-4";
    };

    const cellTextColor = function(onProposal, renderingSelf) {
      if (onProposal && renderingSelf) return "grey-text text-darken-4";
      if (onProposal) return "grey-text text-darken-3";
      if (renderingSelf) return "grey-text text-darken-2";
      return "grey-text text-darken-1";
    };

    const cellTextEmphasis = function(onProposal, renderingSelf) {
      if (onProposal) return "avalon-text-bold";
      return "avalon-text-italic";
    };

    const cellZDepth = function(onProposal, renderingSelf) {
      if (onProposal && renderingSelf) return "z-depth-5";
      if (onProposal) return "z-depth-4";
      if (renderingSelf) return "z-depth-2";
      return "";
    };

    // Name order information is controlled from above. Keep it.
    return this.playerNames.map(function(name) {
      const onProposal = capturedThis.namesOnProposal.includes(name);
      const renderingSelf = name === capturedThis.known.name; 
      const cellColor = cellBackgroundColor(onProposal, renderingSelf);
      const textColor = cellTextColor(onProposal, renderingSelf);
      const textEmphasis = cellTextEmphasis(onProposal, renderingSelf);
      const zDepth = cellZDepth(onProposal, renderingSelf);

      const formatting = `${cellColor} ${textColor} ${textEmphasis} ${zDepth}`;

      // Yes this is sort of duplicating work, but comparing to undefined seems
      // a bit hairy when the value itself is a boolean...
      const hasVote = capturedThis.nameToVotesMap.has(name);
      const allVotes = capturedThis.nameToVotesMap.get(name);
      const prevVote = lastElemOfLastArray(allVotes);
      return {
        name: name,
        proposing: name === capturedThis.currentProposer,
        onProposal: onProposal,
        materializeFormatting: formatting,
        hasPrevVote: hasVote,
        prevVote: prevVote,
        needsToAct: capturedThis.waitingOnNames.includes(name),
      };
    });
  },

  roleList: function() {
    // Sorted to remove any order information.
    return this.roleNames.map(role => role).sort();
  },

  gameHistoryArgs: function() {
    const exampleVoteHistory = this.nameToVotesMap.values().next().value;
    // P is for "*P*layers". The first column is all the player names.
    const headers = ["P"].concat(deduceNecessaryHeaders(exampleVoteHistory));
    
    var rows = [];
    this.nameToVotesMap.forEach(function(value, key, map) {
      rows.push({
        username: key,
        flattenedVoteHistory: flatten(value),
      });
    });
    return {
      colHeaders: headers,
      rows: rows,
    };
  },

  proposalButtonArgs: function() {
    var additionalClasses = "vote-proposal";
    if (!this.waitingOnNames.includes(this.known.name)) {
      additionalClasses += " disabled";
    }

    return {
      helperText: "Tap to approve or reject the proposal.",
      additionalClasses: additionalClasses,
      yesButtonText: "Yea",
      noButtonText: "Nay",
    };
  },

  shouldShowMissionButton: function() {
    return this.inGameInfo.missionInProgress &&
           this.namesOnProposal.includes(this.known.name);
  },
  
  missionButtonArgs: function() {
    var additionalClasses = "mission-proposal";
    if (!this.waitingOnNames.includes(this.known.name)) {
      additionalClasses += " disabled";
    }

    return {
      helperText: "Tap to succeed or fail the mission.",
      additionalClasses: additionalClasses,
      yesButtonText: "{😊}",
      noButtonText: "{😈}",
    };
  },

  leaveGameModalArgs: function() {
    return {
      uniqueId: "leave-game-modal",
      buttonName: "Leave Game",
      modalHeader: "Leave Game?",
      modalText: "Leaving while the game is in progress will " +
                 "probably break the rest of the game. " +
                 "You will not be able to rejoin the same game.",
      modalResponseButtons: [
        // NOTE: `addlButtonClasses` lines up with the `events` handlers below.
        {text: "Leave", addlButtonClasses: "leave-btn"},
        {text: "Never mind"},
      ],
    };
  },

  backToLobbyModalArgs: function() {
    return {
      uniqueId: "back-to-lobby-modal",
      buttonName: "Back to Lobby",
      modalHeader: "Back to Lobby?",
      modalText: "This will put everyone back into the lobby. " +
                 "(Role assignments will be lost, and new people can join the lobby.)",
      modalResponseButtons: [
        // NOTE: `addlButtonClasses` lines up with the `events` handlers below.
        {text: "To the lobby!", addlButtonClasses: "back-to-lobby-btn"},
        {text: "Never mind"},
      ],
    };
  },
});

Template.inGame.events({
  'click .leave-btn': function(e, tmpl) {
    e.preventDefault();

    removeSelf.call(Callbacks.leftGame);
  },

  'click .back-to-lobby-btn': function(e, tmpl) {
    e.preventDefault();

    var roomId = tmpl.data.roomId;
    backToLobby.call({ roomId }, (err, result) => {
      if (err) {
        M.toast({html: err, displayLength: 3000, classes: 'error-toast'});
        return;
      }

      if (result.notRoomOwner) {
        M.toast({html: 'You must be the room owner.', displayLength: 3000, classes: 'error-toast'});
        return;
      } /* else if (result.success) {
        // Updates in the collection should reactively change what renders
        // in `template_single_game`. In particular, we do not need to re-route.
      } */
    });
  },

  'click .proposable': function(e, tmpl) {
    e.preventDefault();

    var roomId = tmpl.data.roomId;
    var listTemplate = e.currentTarget;
    var playerName = listTemplate.getElementsByClassName("username")[0].innerText;

    // Return early if this is not the proposer.
    if (!tmpl.data.isProposer) return;
    // Also return early if the proposal has been finalized already.
    if (tmpl.data.inGameInfo.proposalVoteInProgress) return;
    // Also return early if the mission is in progress.
    if (tmpl.data.inGameInfo.missionInProgress) return;

    toggleOnProposal.call({ roomId, playerName }, (err, result) => {
      if (err) {
        M.toast({html: err, displayLength: 3000, classes: 'error-toast'});
        return;
      }

      if (result.notProposer) {
        M.toast({html: 'You\'re not the proposer.', displayLength: 3000, classes: 'error-toast'});
        return;
      } else if (result.playerNotInRoom) {
        M.toast({html: 'That player is not in the game.', displayLength: 3000, classes: 'error-toast'});
        return;
      } else if (result.missionAlreadyInProgress) {
        M.toast({html: 'Mission already in progress...', displayLength: 3000, classes: 'error-toast'});
        return;
      } /* else if (result.success) {
        // Updates in the collection should reactively change what renders
        // in `template_single_game`. In particular, we do not need to re-route.
      } */
    });
  },

  'click .propose': function(e, tmpl) {
    e.preventDefault();

    var roomId = tmpl.data.roomId;
    finalizeProposal.call({ roomId }, (err, result) => {
      if (err) {
        M.toast({html: err, displayLength: 3000, classes: 'error-toast'});
        return;
      }

      if (result.notProposer) {
        M.toast({html: 'You\'re not the proposer.', displayLength: 3000, classes: 'error-toast'});
        return;
      } else if (result.voteAlreadyInProgress) {
        M.toast({html: 'The vote is already in progress.', displayLength: 3000, classes: 'error-toast'});
        return;
      } /* else if (result.success) {
        // Updates in the collection should reactively change what renders
        // in `template_single_game`. In particular, we do not need to re-route.
      } */
    });
  },

  'click .vote-proposal': function(e, tmpl) {
    e.preventDefault();

    var roomId = tmpl.data.roomId;
    const clickedButton = e.currentTarget;
    const vote = clickedButton.classList.contains("vote-yes");
    voteOnProposal.call({ roomId, vote }, (err, result) => {
      if (err) {
        M.toast({html: err, displayLength: 3000, classes: 'error-toast'});
        return;
      }

      if (result.proposalNotFinalized) {
        M.toast({html: 'The proposal isn\'t finalized.', displayLength: 3000, classes: 'error-toast'});
        return;
      } else if (result.alreadyVoted) {
        M.toast({html: 'You already voted!', displayLength: 3000, classes: 'error-toast'});
        return;
      } /* else if (result.success) {
        // Updates in the collection should reactively change what renders
        // in `template_single_game`. In particular, we do not need to re-route.
      } */
    });
  },

  'click .mission-proposal': function(e, tmpl) {
    e.preventDefault();

    var roomId = tmpl.data.roomId;
    const clickedButton = e.currentTarget;
    const vote = clickedButton.classList.contains("vote-yes");

    voteOnMission.call({ roomId, vote }, (err, result) => {
      if (err) {
        M.toast({html: err, displayLength: 3000, classes: 'error-toast'});
        return;
      }

      if (result.missionNotFinalized) {
        M.toast({html: 'The mission hasn\'t started yet.', displayLength: 3000, classes: 'error-toast'});
        return;
      } else if (result.notOnMission) {
        M.toast({html: 'You\'re not on this mission!', displayLength: 3000, classes: 'error-toast'});
        return;
      } else if (result.alreadyVoted) {
        M.toast({html: 'You already voted!', displayLength: 3000, classes: 'error-toast'});
        return;
      } /* else if (result.success) {
        // Updates in the collection should reactively change what renders
        // in `template_single_game`. In particular, we do not need to re-route.
      } */
    });
  },
});

Template.gameHistory.helpers({
  // TODO(neemazad): Formatting the cell doesn't look great. Maybe we're better
  // off adding "shield" emojis inside the table instead, or something.
  formatVoteCell: function(vote) {
    return "";
    // if (vote) return "green lighten-5";
    // return "red lighten-5";
  },
});
