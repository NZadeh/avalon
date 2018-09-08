import { joinRoom } from '/lib/collections/game_rooms/methods';
import { HelperConstants } from '/lib/collections/game_rooms/constants';
import { Permissions } from '/lib/utils/permissions';

Template.gameTile.helpers({
    currentNumPlayers: function() {
        return this.players.length;
    },

    maxNumPlayers: function() {
        return HelperConstants.kMaxPlayers;
    },
});

Template.gameTile.events({
    'click .join': function(e, tmpl) {
        e.preventDefault();

        var roomId = this._id;

        if (Permissions.activeUserIsInGameRoom(roomId)) {
            FlowRouter.go('gameLobby', {
                _id: roomId
            });
            return;
        }

        var password = '';
        if (this.passwordProtected) {
            password = prompt('Enter the room\'s password:');
            if (password === null && typeof password === 'object') {
                return; //they canceled
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
                FlowRouter.go('gameLobby', {
                    _id: roomId
                });
            } else {
                Materialize.toast('An unknown error prevented you from joining this room.', 3000, 'error-toast');
            }
        });
    }
});
