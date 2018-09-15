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
    }
});

Template.inGame.events({
    'click .leave-btn': function(e, tmpl) {
        e.preventDefault();

        if (confirm('Are you sure you want to leave? This may (indirectly) reveal your role. You cannot rejoin the same game.')) {
            removeSelf.call(Callbacks.leftGame);
        }
    },

    'click .back-to-lobby-btn': function(e, tmpl) {
        e.preventDefault();

        if (confirm('This will put everyone back into the lobby. (Role assignments will be lost.) Are you sure you want to leave?')) {
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
    }
});
