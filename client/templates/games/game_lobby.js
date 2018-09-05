import {
  deleteGameRoom,
  startGame,
  removePlayer
} from '/lib/collections/game_rooms';

Template.gameLobby.helpers({
    isRoomOwner: function() {
        return isRoomOwner(this);
    },

    normalPlayers: function() {
        var ownerId = this.userId;
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
            } else if (result.success) {
                // TODO(neemazad): Probably do something here. Can we route players to a new route?
            }
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

            Router.go('home');
        });
    },
    'click .kick': function(e, tmpl) {
        e.preventDefault();

        // TODO(neemazad): More principled way of getting this id?
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
            // TODO(neemazad): Consider implementing some "error checking" so that
            // only the owner can kick people id's inside the room, etc.
        });
    },
    'click .leave': function(e, tmpl) {
        // TODO(neemazad): Unify with game_template.js.
        e.preventDefault();

        var removedId = Meteor.userId();
        removePlayer.call({ removedId }, (err, result) => {
            if (err) {
                Materialize.toast(err.reason, 3000, 'error-toast');
                return;
            }

            if (result.notLoggedOn) {
                Materialize.toast('You\'re not logged in.', 3000, 'error-toast');
                return;
            } else if (result.notInRoom) {
                Materialize.toast('You need to be in a room to leave.', 3000, 'error-toast');
                return;
            } else if (result.success) {
                Router.go('home');
            }
        });
    }
});