import {
    joinRoom,
    removeSelf,
} from '/lib/collections/game_rooms/methods';

import { HelperConstants } from '/lib/collections/game_rooms/constants';
import { Callbacks } from '/lib/utils/callbacks';

Template.gameTile.helpers({
    currentNumPlayers: function() {
        return this.players.length;
    },

    maxNumPlayers: function() {
        return HelperConstants.kMaxPlayers;
    },

    joinContext: function() {
        const instance = Template.instance();

        return {
            playerNotLoggedIn: !instance.data.playerLoggedIn,
            playerAlreadyInside: instance.data.playerAlreadyInside,
            gameInProgress: !instance.data.open,
            playerInsideAnotherGame: instance.data.playerInsideAnotherGame,
            roomId: instance.data._id,
            passwordProtected: instance.data.passwordProtected,
        };
    }
});

Template.joinButton.events({
    'click .join': function(e, tmpl) {
        e.preventDefault();

        const roomId = tmpl.data.roomId;
        if (tmpl.data.playerAlreadyInside) {
            FlowRouter.go('singleGame', {
                _id: roomId
            });
            return;
        }

        var password = '';
        if (tmpl.data.passwordProtected) {
            password = prompt('Enter the room\'s password:');
            if (password === null && typeof password === 'object') {
                return;  // Dismissed the prompt -- no password available.
            }
        }

        joinRoom.call({ roomId, password },  (err, result) => {
            if (err) {
                Materialize.toast(err.reason, 3000, 'error-toast');
                return;
            }

            if (result.alreadyInRoom) {
                Materialize.toast('You\'re already in a room.', 3000, 'error-toast');
            } else if (result.alreadyStarted) {
                Materialize.toast('This game has already started.', 3000, 'error-toast');
            } else if (result.isAtCapacity) {
                Materialize.toast('Sorry, the room you\'re trying to join is full.', 3000, 'error-toast');
            } else if (result.wrongPassword) {
                Materialize.toast('Incorrect password.', 3000, 'error-toast');
            } else if (result.success) {
                FlowRouter.go('singleGame', {
                    _id: roomId
                });
            } else {
                Materialize.toast('An unknown error prevented you from joining this room.', 3000, 'error-toast');
            }
        });
    },

    'click .leave': function(e, tmpl) {
        e.preventDefault();
        removeSelf.call(Callbacks.leftGame);
    },
});
