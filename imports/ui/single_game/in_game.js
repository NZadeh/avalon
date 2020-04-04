import './in_game.html';

import { GameRooms } from '/imports/collections/game_rooms/game_rooms';
import { HelperConstants } from '/imports/collections/game_rooms/constants';
import { Callbacks } from '/imports/utils/callbacks';
import { CommonUiCode } from '/imports/ui/common/common_ui_code';

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

// Anonymous helper!
const lastElemOfLastArray = function(nestedArray) {
  // Base case.
  if (nestedArray != undefined && !(nestedArray instanceof Array)) {
    return nestedArray;
  }

  for (let index = nestedArray.length - 1; index >= 0; --index) {
    let lastElem = lastElemOfLastArray(nestedArray[index])
    if (lastElem != undefined) return lastElem;
  }

  return undefined;
};

// Anonymous helper to create ["1.1", "1.2", ..., "3.4"].
const deduceNecessaryHeaders = function(voteHistory, successesFails) {
  var headers = [];
  var mission = 1;
  voteHistory.forEach(function(proposalVotes) {
    for (let proposalNum = 1; proposalNum <= proposalVotes.length; ++proposalNum) {
      headers.push(`${mission}.${proposalNum}`);
    }
    // A header for the mission result.
    if (successesFails.length > mission - 1) headers.push(`${mission}.*`);
    mission++;
  });
  return headers;
};

const booleanArrayOf = function(numTrue, numFalse) {
  return Array(numTrue + numFalse)
             .fill(true, 0, numTrue)
             .fill(false, numTrue, numTrue + numFalse);
};

const flatten = function(nestedArray, insertAtArrayBoundary) {
  function flattenHelper(nestedArray, insertAtArrayBoundary, output) {
    // Base case
    if (!(nestedArray instanceof Array)) {
      output.push(nestedArray);
      return;
    }

    // Still unnesting
    nestedArray.forEach(function(maybeNestedArray, index) {
      flattenHelper(
        maybeNestedArray,
        insertAtArrayBoundary ? insertAtArrayBoundary[index] : undefined,
        output);
    });

    // "1-level-above-base-case" where we need to append an element after
    // unnesting and calling all of the single-element base cases on a flat
    // array.
    if (insertAtArrayBoundary != undefined && 
        !(insertAtArrayBoundary instanceof Array)) {
      output.push(insertAtArrayBoundary);
    }
  };

  var flattened = [];
  flattenHelper(nestedArray, insertAtArrayBoundary, flattened);
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
      const isAbsent = capturedThis.absentNames.includes(name);
      const renderingSelf = name === capturedThis.known.name; 
      const cellColor = cellBackgroundColor(onProposal, renderingSelf);
      const textColor = cellTextColor(onProposal, renderingSelf);
      const textEmphasis = cellTextEmphasis(onProposal, renderingSelf);
      const zDepth = cellZDepth(onProposal, renderingSelf);

      const formatting = `${cellColor} ${textColor} ${textEmphasis} ${zDepth}`;

      const allVotes = capturedThis.nameToVotesMap.get(name);
      const prevVoteObj = lastElemOfLastArray(allVotes);
      const prevState = {
        hasPrevVote: prevVoteObj != undefined,
        prevVote: prevVoteObj ? prevVoteObj.vote : undefined,
        onPrevProposal: prevVoteObj ? prevVoteObj.wasOnProposal : undefined,
      };
      const remainingProposerNames = capturedThis.remainingProposerNames;

      return {
        name: name,
        proposing: name === capturedThis.currentProposer,
        mightProposeThisMission: remainingProposerNames.includes(name),
        proposalPosition: capturedThis.inGameInfo.currentProposalNumber +
                          remainingProposerNames.indexOf(name),
        onProposal: onProposal,
        absent: isAbsent,
        materializeFormatting: formatting,
        prevState: prevState,
        needsToAct: capturedThis.waitingOnNames.includes(name),
      };
    });
  },

  roleList: function() {
    // Sorted to remove any order information.
    return this.roleNames.map(role => role).sort();
  },

  gameHistoryArgs: function() {
    // TODO(neemazad): Implement collapsing vote history... (to show
    // only finished missions and current mission proposals)
    const exampleVoteHistory = this.nameToVotesMap.values().next().value;
    // We are going to "insert" fake "votes" that signify mission outcomes.
    const voteLikeSuccessesFails = this.inGameInfo.missionOutcomes.map(
        outcome => ({
          isMissionResult: true,
          missionSpecifics: booleanArrayOf(outcome.successes, outcome.fails)
                              .map(success => ({
                                success: success,
                                formatting: "text-darken-3 " + 
                                            (outcome.succeeded ?
                                                "blue-text" :
                                                "red-text"),
                              })),
        })
    );
    // The first column is all the player names.
    const headers = ["Player"].concat(
        deduceNecessaryHeaders(exampleVoteHistory, voteLikeSuccessesFails));
    
    var rows = [];
    const capturedNameToVotesMap = this.nameToVotesMap;
    const currentProposalNumber = this.inGameInfo.currentProposalNumber;
    const remainingProposerNames = this.remainingProposerNames;

    // Render history in player order.
    this.playerNames.forEach(function(name) {
      const voteHistory = capturedNameToVotesMap.get(name);

      rows.push({
        username: name,
        mightProposeThisMission: remainingProposerNames.includes(name),
        proposalPosition: currentProposalNumber + remainingProposerNames.indexOf(name),
        flattenedVoteHistory: flatten(voteHistory, voteLikeSuccessesFails),
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
      additionalClasses += ` ${HelperConstants.kDisabledButtonClass}`;
    }

    return {
      helperText: "Tap to approve or reject the proposal.",
      additionalClasses: additionalClasses,
      yesImgName: "approve_token_med",
      noImgName: "reject_token_med",
      type: "token",
    };
  },

  shouldShowMissionButton: function() {
    return this.inGameInfo.missionInProgress &&
           this.namesOnProposal.includes(this.known.name);
  },
  
  missionButtonArgs: function() {
    var additionalClasses = "mission-proposal";
    if (!this.waitingOnNames.includes(this.known.name)) {
      additionalClasses += ` ${HelperConstants.kDisabledButtonClass}`;
    }

    return {
      helperText: "Tap to succeed or fail the mission.",
      additionalClasses: additionalClasses,
      yesImgName: "success_card_med",
      noImgName: "fail_card_med",
      type: "card",
      modalArgs: {
        uniqueId: "mission-modal",
        modalHeader: "You're on mission!",
        modalText: "Dismiss this window to vote with the cards.",
        modalResponseButtons: [
          { text: "Dismiss" },
        ],
      },
    };
  },

  leaveGameModalArgs: function() {
    // NOTE: The class name lines up with the `events` handlers below.
    return CommonUiCode.leaveGameModalArgs("leave-btn");
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
    if (clickedButton.classList.contains(HelperConstants.kDisabledButtonClass)) {
      return;  // Do nothing if the "button" is disabled.
    }

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
    if (clickedButton.classList.contains(HelperConstants.kDisabledButtonClass)) {
      return;  // Do nothing if the "button" is disabled.
    }

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
      } else if (result.cantFail) {
        M.toast({html: 'Your role can\'t fail a mission!', displayLength: 3000, classes: 'error-toast'});
        return;
      } /* else if (result.success) {
        // Updates in the collection should reactively change what renders
        // in `template_single_game`. In particular, we do not need to re-route.
      } */
    });
  },
});

Template.avalonTokenRow.helpers({
  padToFive(outcomes) {
    var stringOutcomes = outcomes.map(outcome => outcome ? "success" : "fail")
    for (let i = 0; i < 5 - outcomes.length; ++i) {
      stringOutcomes.push(`${i}`);
    }
    return stringOutcomes;
  },

  success(outcome) {
    return outcome === "success";
  },

  failure(outcome) {
    return outcome === "fail";
  },

  // TODO(neemazad): Could do a exponentially decaying opacity here...
  // instead of special casing the current mission and all other missions.
  currentMission(outcome) {
    return outcome === "0";
  },
});

Template.missionVote.onRendered(function() {
  // Note, the `triggeredModal` sub-template has already been initialized
  // by this point. Here we can just open the modal without re-initializing.
  const modalHtml = document.querySelector(`#${this.data.modalArgs.uniqueId}`);
  var modal = M.Modal.getInstance(modalHtml);
  modal.open();
});

Template.maybeTagProposer.helpers({
  materializeNumber(position) {
    return `filter_${position}`;
  },
});

Template.listPlayer.helpers({
  // Just for fun :)
  customizeProposerIcon(username) {
    if (username === "Dilsher") return "directions_bus";
    return "event_seat";
  },
});
