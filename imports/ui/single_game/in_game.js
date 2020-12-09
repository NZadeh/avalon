import './in_game.html';

import { GameRooms } from '/imports/collections/game_rooms/game_rooms';
import { HelperConstants } from '/imports/collections/game_rooms/constants';
import { HelperMethods } from '/imports/collections/game_rooms/methods_helper';
import { Callbacks } from '/imports/utils/callbacks';
import { CommonUiCode } from '/imports/ui/common/common_ui_code';

import {
  removeSelf,
  backToLobby,
  toggleOnProposal,
  finalizeProposal,
  voteOnProposal,
  voteOnMission,
  toggleOnAssassinationList,
  finalizeAssassination,
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

// Anonymous helper to create ["1.4", "2.2", "3.1", "3.2", "3.3", "3.4"]
// if the game has had two missions pass (1 @ proposal 4, 2 @ proposal 2)
// and is 4 proposals into mission 3.
const deduceNecessaryHeaders = function(voteHistory, successesFails) {
  var headers = [];
  voteHistory.forEach(function(proposalVotes, index, voteHistory) {
    mission = index + 1;  // 1-based counting for mission numbers.

    if (index < voteHistory.length - 1) {
      headers.push(`${mission}.${proposalVotes.length}`);
    } else {
      for (let proposalNum = 1;
           proposalNum <= proposalVotes.length;
           ++proposalNum) {
        headers.push(`${mission}.${proposalNum}`);
      }
    }

    // A header for the mission result.
    if (index < successesFails.length) headers.push(`${mission}.*`);
  });
  return headers;
};

const booleanArrayOf = function(numTrue, numFalse) {
  return Array(numTrue + numFalse)
             .fill(true, 0, numTrue)
             .fill(false, numTrue, numTrue + numFalse);
};

// NOTE: Needs to stay in sync with deduceNecessaryHeaders.
// Grabs the last element of each array that isn't the last.
// Consecutively inserts an element of the second array between each.
// Appends all the elements of the last array.
const collapsedVoteHistory = function(arrOfArr, insertAtArrayBoundary) {
  var flattened = [];

  arrOfArr.forEach(function(arr, index, arrOfArr) {
    if (index < arrOfArr.length - 1) {
      flattened.push(arr[arr.length - 1]);
    } else {
      flattened.push(...arr);
    }

    if (index < insertAtArrayBoundary.length) {
      flattened.push(insertAtArrayBoundary[index])
    }
  });

  return flattened;
};

const numRequiredOnMission = function(inGameInfo) {
  return inGameInfo.numShouldBeOnProposal();
};

Template.inGame.helpers({
  numRequiredOnMission: function() {
    return numRequiredOnMission(this.inGameInfo);
  },

  conditionallyDisabled: function(existingClasses) {
    return existingClasses +
        (this.inGameInfo.numCurrentlyOnProposal() === 
         this.inGameInfo.numShouldBeOnProposal() ?
            "" :
            " disabled");
  },

  conditionallyDisabledAssassination: function(existingClasses) {
    return existingClasses +
        (this.inGameInfo.numCurrentlyOnAssassinationList() === 1 ?
            "" :
            " disabled");
  },

  computeMissionCounts: function() {
    const playerCount = this.inGameInfo.playersInGame.length;

    return this.inGameInfo.missionCounts.map(function(count, index) {
      let mission = index + 1;
      let needsTwoFails =
          HelperMethods.numFailsRequired(playerCount, mission) >= 2;
      return {
        count: count,
        needsTwoFails: needsTwoFails,
      };
    });
  },

  previousMissionOutcomes: function() {
    return this.inGameInfo.missionOutcomes.map(outcome => outcome.succeeded);
  },

  isGameOver: function() {
    // TODO: Change to exclude Assassination phase probs... 
    return this.inGameInfo.isGameOverState();
  },

  proposalVoteInProgress: function() {
    return this.inGameInfo.gamePhase === "proposalVoteInProgress";
  },

  missionInProgress: function() {
    return this.inGameInfo.gamePhase === "missionInProgress";
  },

  assassinationPhase: function() {
    return this.inGameInfo.gamePhase === "assassinationPhase";
  },

  gameStateText: function() {
    const phase = this.inGameInfo.gamePhase;
    if (phase === 'proposalInProgress') return "(A proposal is in progress.)";
    if (phase === 'proposalVoteInProgress') return "(Everyone must vote on this proposal.)";
    if (phase === 'missionInProgress') return "(A mission is in progress.)";
    if (phase === 'spiesWinOnFails') return "Spies win on fails.";
    if (phase === 'assassinationPhase') return "The Assassin reveals; Spies find Merlin.";
    if (phase === 'spiesWinInAssassination') return "Spies found Merlin and win.";
    if (phase === 'resistanceWin') return "Resistance win with Merlin hidden.";
    return "(Game in progress...)"; // Unused...
  },

  playersList: function() {
    const cellBackgroundColor = function(
        onProposal, onAssassinationList, renderingSelf) {
      if (onProposal) return "green lighten-4";
      if (onAssassinationList) return "black accent-1";
      return "grey lighten-4";
    };

    const cellTextColor = function(
        onProposal, onAssassinationList, renderingSelf) {
      if (onProposal && renderingSelf) return "grey-text text-darken-4";
      if (onProposal) return "grey-text text-darken-3";
      if (onAssassinationList) return "red-text text-darken-4";
      if (renderingSelf) return "grey-text text-darken-2";
      return "grey-text text-darken-1";
    };

    const cellTextEmphasis = function(
        onProposal, onAssassinationList, renderingSelf) {
      if (onProposal) return "avalon-text-bold";
      if (onAssassinationList) return "avalon-text-strikethrough";
       
      return "avalon-text-italic";
    };

    const cellZDepth = function(
        onProposal, onAssassinationList, renderingSelf) {
      if (onProposal && renderingSelf) return "z-depth-5";
      if (onProposal || onAssassinationList) return "z-depth-4";
      if (renderingSelf) return "z-depth-2";
      return "";
    };

    // Name order information is controlled by the order in this map.
    return Array.from(this.orderedNameToAllInfoMap, ([name, nameInfo]) => {
      const onProposal = nameInfo.onProposal;
      const onAssassinationList = nameInfo.onAssassinationList;
      const isAbsent = nameInfo.absent;
      const renderingSelf = nameInfo.isSelf;
      const cellColor = cellBackgroundColor(
          onProposal, onAssassinationList, renderingSelf);
      const textColor = cellTextColor(
          onProposal, onAssassinationList, renderingSelf);
      const textEmphasis = cellTextEmphasis(
          onProposal, onAssassinationList, renderingSelf);
      const zDepth = cellZDepth(
          onProposal, onAssassinationList, renderingSelf);

      const formatting = `${cellColor} ${textColor} ${textEmphasis} ${zDepth}`;

      const allVotes = nameInfo.allVotes;
      const prevVoteObj = lastElemOfLastArray(allVotes);
      const prevState = {
        hasPrevVote: prevVoteObj != undefined,
        prevVote: prevVoteObj ? prevVoteObj.vote : undefined,
        onPrevProposal: prevVoteObj ? prevVoteObj.wasOnProposal : undefined,
      };

      return {
        name: name,
        proposing: nameInfo.isProposer,
        mightProposeThisMission: nameInfo.mightProposeThisMission,
        proposalPosition: nameInfo.proposalPosition,
        onProposal: onProposal,
        onAssassinationList: onAssassinationList,
        absent: isAbsent,
        materializeFormatting: formatting,
        prevState: prevState,
        needsToAct: nameInfo.isBlocking,
      };
    });
  },

  roleList: function() {
    // Sorted to remove any order information.
    return this.roleNames.map(role => role).sort();
  },

  gameHistoryArgs: function() {
    const exampleVoteHistory = this.orderedNameToAllInfoMap.values().next().value.allVotes;
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
    // Render history in player order.
    this.orderedNameToAllInfoMap.forEach(function(allInfo, name) {
      rows.push({
        username: name,
        mightProposeThisMission: allInfo.mightProposeThisMission,
        proposalPosition: allInfo.proposalPosition,
        flattenedVoteHistory: collapsedVoteHistory(allInfo.allVotes,
                                                   voteLikeSuccessesFails),
      });
    });
    return {
      colHeaders: headers,
      rows: rows,
    };
  },

  proposalButtonArgs: function() {
    var additionalClasses = "vote-proposal";
    if (!this.orderedNameToAllInfoMap.get(this.known.name).isBlocking) {
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
    return this.inGameInfo.gamePhase === "missionInProgress" &&
           this.orderedNameToAllInfoMap.get(this.known.name).onProposal;
  },

  proposerPopupArgs: function() {
    const num = numRequiredOnMission(this.inGameInfo);
    return {
      modalArgs: {
        uniqueId: "proposer-popup-modal",
        modalHeader: "You're the proposer!",
        modalText: `Tap on ${num} player names to add them to your mission ` +
                   "proposal, then hit the 'Propose' button to let " +
                   "everyone vote on it.",
        modalResponseButtons: [
          { text: "Dismiss" },
        ],
      },
    };
  },

  assassinationPopupArgs: function() {
    return {
      modalArgs: {
        uniqueId: "assassination-popup-modal",
        modalHeader: "You're the Assassin!",
        modalText: "Discuss with your team who you think Merlin is, " +
                   "click on that player's name, then hit the 'Assassinate!' " +
                   "when you have finalized your choice.",
        modalResponseButtons: [
          { text: "(Merlin's as good as dead.)" },
        ],
      },
    };
  },
  
  missionButtonArgs: function() {
    var additionalClasses = "mission-proposal";
    if (!this.orderedNameToAllInfoMap.get(this.known.name).isBlocking) {
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
    // TODO(neemazad): There could be some weirdness here if a player
    // edits the HTML via developer console... (shouldn't be able to
    // break the game, though, I don't think...)
    var playerName = listTemplate.getElementsByClassName("username")[0].innerText;

    // Return early if this is not the proposer.
    if (!tmpl.data.isProposer) return;
    // Also return early if it's not proposal time.
    if (tmpl.data.inGameInfo.gamePhase !== "proposalInProgress") return;

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

  'click .assassinatable': function(e, tmpl) {
    e.preventDefault();

    var roomId = tmpl.data.roomId;
    var listTemplate = e.currentTarget;
    // TODO(neemazad): There could be some weirdness here if a player
    // edits the HTML via developer console... (shouldn't be able to
    // break the game, though, I don't think...)
    var playerName = listTemplate.getElementsByClassName("username")[0].innerText;

    // Return early if this is not the proposer.
    if (!tmpl.data.isAssassin) return;
    // Also return early if it's not proposal time.
    if (tmpl.data.inGameInfo.gamePhase !== "assassinationPhase") return;

    toggleOnAssassinationList.call({ roomId, playerName }, (err, result) => {
      if (err) {
        M.toast({html: err, displayLength: 3000, classes: 'error-toast'});
        return;
      }

      if (result.notAssassin) {
        M.toast({html: 'You\'re not the Assassin.', displayLength: 3000, classes: 'error-toast'});
        return;
      } else if (result.playerNotInRoom) {
        M.toast({html: 'That player is not in the game.', displayLength: 3000, classes: 'error-toast'});
        return;
      } else if (result.notAssassinationPhase) {
        M.toast({html: 'It is too early to assassinate...', displayLength: 3000, classes: 'error-toast'});
        return;
      } /* else if (result.success) {
        // Updates in the collection should reactively change what renders
        // in `template_single_game`. In particular, we do not need to re-route.
      } */
    });
  },

  'click .assassinate': function(e, tmpl) {
    e.preventDefault();

    var roomId = tmpl.data.roomId;
    finalizeAssassination.call({ roomId }, (err, result) => {
      if (err) {
        M.toast({html: err, displayLength: 3000, classes: 'error-toast'});
        return;
      }

      if (result.notAssassin) {
        M.toast({html: 'You\'re not the Assassin.', displayLength: 3000, classes: 'error-toast'});
        return;
      } else if (result.notAssassinationPhase) {
        M.toast({html: 'It is too early to assassinate...', displayLength: 3000, classes: 'error-toast'});
        return;
      } /* else if (result.success) {
        // Updates in the collection should reactively change what renders
        // in `template_single_game`. In particular, we do not need to re-route.
      } */
    });
  },
});

Template.avalonTokenRow.helpers({
  // NOTE: `missionCounts` is optional, and can be undefined.
  padToFive(outcomes, missionCounts) {
    var stringOutcomes = outcomes.map(outcome => outcome ? "success" : "fail");
    for (let i = 0; i < 5 - outcomes.length; ++i) {
      stringOutcomes.push(`${i}`);
    }

    return stringOutcomes.map(function(outcome, index) {
      return {
        outcome: outcome,
        missionCount: (missionCounts ?
                          missionCounts[index].count :
                          undefined),
        needsTwoFails: (missionCounts ? 
                            missionCounts[index].needsTwoFails :
                            undefined),
      };
    });
  },

  // NOTE: either argument can be undefined. (See above.)
  tokenTextString(count, doubleFail) {
    if (count === undefined || doubleFail === undefined) return undefined;
    if (doubleFail) return `${count}*`;
    return `${count}`;
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

  textStyle(outcome) {
    if (outcome === "0") return "";
    if (outcome === "success" || outcome === "fail") return "past-mission";
    return "future-mission";
  },
});

// TODO(neemazad): Maybe make these all the same...? why have 3 of these?
Template.proposerPopup.onRendered(function() {
  // Note, the `triggeredModal` sub-template has already been initialized
  // by this point. Here we can just open the modal without re-initializing.
  const modalHtml = document.querySelector(`#${this.data.modalArgs.uniqueId}`);
  var modal = M.Modal.getInstance(modalHtml);
  modal.open();
});

Template.missionVote.onRendered(function() {
  // Note, the `triggeredModal` sub-template has already been initialized
  // by this point. Here we can just open the modal without re-initializing.
  const modalHtml = document.querySelector(`#${this.data.modalArgs.uniqueId}`);
  var modal = M.Modal.getInstance(modalHtml);
  modal.open();
});

Template.assassinationPopup.onRendered(function() {
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
