import {
  deleteGameRoom,
  startGame,
  removePlayer,
  removeSelf,
} from '/lib/collections/game_rooms/methods';

import { Callbacks } from '/lib/utils/callbacks';
import { Permissions } from '/lib/utils/permissions';

Template.gameLobby.helpers({
    // TODO(neemazad): Take this information in from the template, instead of computing it.
    isRoomOwner: function() {
        return Permissions.isRoomOwner(this);
    },

    normalPlayers: function() {
        var ownerId = this.ownerId;
        var nonOwners = this.players.filter(function(player) {
            //as long as they're not the author
            return player._id !== ownerId;
        });
        return nonOwners;
    },

    currNumPlayers: function() {
        return this.players.length;
    }
});

Template.gameLobby.events({
    'click .start': function(e, tmpl) {
        e.preventDefault();

        // Because of some reason I don't exactly understand, using `this._id`
        // did not work. Because we're using {{> button args1 args2 }} syntax,
        // it looks like the data context (`this`) becomes args1 and args2,
        // but somehow, the information appears to be passed in to the second
        // argument, where we can access what used to be this via `tmpl.data`(?).
        var roomId = tmpl.data._id;
        startGame.call({ roomId }, (err, result) => {
            if (err) {
                Materialize.toast(err.reason, 3000, 'error-toast');
                return;
            }

            if (result.notEnoughPlayers) {
                Materialize.toast('You need more players to start.', 3000, 'error-toast');
                return;
            } else if (result.tooManyPlayers) {
                Materialize.toast('You have too many players to start.', 3000, 'error-toast');
                return;
            } /* else if (result.success) {
                // Updates in the collection should reactively change what renders
                // in `template_single_game`. In particular, we do not need to re-route.
            } */
        });
    },
    'click .delete': function(e, tmpl) {
        e.preventDefault();

        // See note above for using `tmpl.data._id` here
        var roomId = tmpl.data._id;
        deleteGameRoom.call({ roomId }, (err, result) => {
            if (err) {
                Materialize.toast(err.reason, 3000, 'error-toast');
                return;
            }

            if (result.notRoomOwner) {
                Materialize.toast('You must be the room owner to delete a game.', 3000, 'error-toast');
                return;
            }

            FlowRouter.go('home');
        });
    },
    'click .kick': function(e, tmpl) {
        e.preventDefault();

        var removedId = e.currentTarget.children[0].innerText;
        if (!removedId || removedId.length == 0) {
            console.log("Failed to kick player -- bad id.")
            return;
        }

        removePlayer.call({ removedId }, (err, result) => {
            if (err) { 
                Materialize.toast(err.reason, 3000, 'error-toast');
                return;
            }
        });
    },
    'click .leave': function(e, tmpl) {
        e.preventDefault();
        removeSelf.call(Callbacks.leftGame);
    }
});
