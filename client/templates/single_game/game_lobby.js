import {
  deleteGameRoom,
  startGame,
  removePlayer,
  removeSelf,
} from '/lib/collections/game_rooms/methods';

import { Callbacks } from '/lib/utils/callbacks';

Template.gameLobby.helpers({
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
        player.renderingForOwner = Template.instance().data.isRoomOwner;
        return player;
    },
});

Template.gameLobby.events({
    'click .start': function(e, tmpl) {
        e.preventDefault();

        var roomId = tmpl.data.gameRoom._id;
        startGame.call({ roomId }, (err, result) => {
            if (err) {
                M.toast({html: err.reason, displayLength: 3000, classes: 'error-toast'});
                return;
            }

            if (result.notEnoughPlayers) {
                M.toast({html: 'You need more players to start.', displayLength: 3000, classes: 'error-toast'});
                return;
            } else if (result.tooManyPlayers) {
                M.toast({html: 'You have too many players to start.', displayLength: 3000, classes: 'error-toast'});
                return;
            } /* else if (result.success) {
                // Updates in the collection should reactively change what renders
                // in `template_single_game`. In particular, we do not need to re-route.
            } */
        });
    },
    'click .delete': function(e, tmpl) {
        e.preventDefault();

        var roomId = tmpl.data.gameRoom._id;
        deleteGameRoom.call({ roomId }, (err, result) => {
            if (err) {
                M.toast({html: err.reason, displayLength: 3000, classes: 'error-toast'});
                return;
            }

            if (result.notRoomOwner) {
                M.toast({html: 'You must be the room owner to delete a game.', displayLength: 3000, classes: 'error-toast'});
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
                M.toast({html: err.reason, displayLength: 3000, classes: 'error-toast'});
                return;
            }
        });
    },
    'click .leave': function(e, tmpl) {
        e.preventDefault();
        removeSelf.call(Callbacks.leftGame);
    }
});
