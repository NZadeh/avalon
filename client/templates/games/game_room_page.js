Template.gameRoomPage.helpers({
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
    }
});

Template.gameRoomPage.events({
    'click .start': function(e, tmpl) {
        e.preventDefault();
        console.log(this);  // TODO(neemazad): Issue here with template...

        Meteor.call('startGame', this._id, function(err, result) {
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
                //ga
                ga('send', 'event', 'game', 'start');
            }
        });
    },
    'click .delete': function(e, tmpl) {
        e.preventDefault();

        Meteor.call('deleteGameRoom', this._id, function(err, result) {
            if (err) {
                Materialize.toast(err.reason, 3000, 'error-toast');
                return;
            }

            if (result.notRoomOwner) {
                Materialize.toast('Only the room owner can delete this room.', 3000, 'error-toast');
                return;
            } else if (result.success) {
                //ga
                ga('send', 'event', 'game', 'delete');

                Router.go('home');
            }
        });
    },
    'click .kick': function(e, tmpl) {
        e.preventDefault();

        // TODO(neemazad): More principled way of getting this id?
        var id = e.currentTarget.children[0].innerText;
        if (!id || id.length == 0) {
            console.log("Failed to kick player -- bad id.")
            return;
        }

        Meteor.call('kickPlayer', id, function (err, result) {
            if (err) { 
                Materialize.toast(err.reason, 3000, 'error-toast');
                return;
            }
        });
    },
    'click .leave': function(e, tmpl) {
        // TODO(neemazad): Unify with game_template.js.
        e.preventDefault();

        Meteor.call('removeJoinAuth', function (err, result) {
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
                //ga
                ga('send', 'event', 'game', 'leave');

                Router.go('home');
            }
        });
    }
});