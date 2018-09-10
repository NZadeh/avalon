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
    },

    extendContext: function(player) {
        player.renderingForOwner = Permissions.isRoomOwner(this);
        return player;
    },
});

Template.gameLobby.events({
    'click .start': function(e, tmpl) {
        e.preventDefault();

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
