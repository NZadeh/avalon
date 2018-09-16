import { GameRooms } from '/lib/collections/game_rooms/game_rooms';
import { HelperConstants } from '/lib/collections/game_rooms/constants';
import { Callbacks } from '/lib/utils/callbacks';

import {
  removeSelf,
  backToLobby,
} from '/lib/collections/game_rooms/methods';

Template.inGame.helpers({
  playersList: function() {
    // Sorted to remove any order information.
    return this.playerNames.map(player => player).sort();
  },

  roleList: function() {
    // Sorted to remove any order information.
    return this.roleNames.map(role => role).sort();
  },

  leaveGameModalArgs: function() {
    return {
      uniqueId: "leave-game-modal",
      buttonName: "Leave Game",
      modalHeader: "Leave Game?",
      modalText: "Leaving may (indirectly) reveal your role. " +
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
        M.toast({html: err.reason, displayLength: 3000, classes: 'error-toast'});
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
  }
});
