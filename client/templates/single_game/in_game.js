import { GameRooms } from '/lib/collections/game_rooms/game_rooms';
import { HelperConstants } from '/lib/collections/game_rooms/constants';
import { Callbacks } from '/lib/utils/callbacks';
import { Permissions } from '/lib/utils/permissions';

import {
  removeSelf,
  backToLobby,
} from '/lib/collections/game_rooms/methods';

Template.inGame.helpers({
    // TODO(neemazad): Take this information in from the template, instead of computing it.
    isRoomOwner: function() {
        return Permissions.isRoomOwner(this);
    },

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
                    Materialize.toast(err.reason, 3000, 'error-toast');
                    return;
                }

                if (result.notRoomOwner) {
                    Materialize.toast('You must be the room owner.', 3000, 'error-toast');
                    return;
                } else if (result.success) {
                    // Updates in the collection should reactively change what renders
                    // in `template_single_game`. In particular, we do not need to re-route.
                    Materialize.toast('Success!', 3000, 'success-toast');
                } else {
                    Materialize.toast('Unknown error. (Nothing happened... Log off and log back on?)', 3000, 'error-toast');
                    return;
                }
            });
        }
    }
});
