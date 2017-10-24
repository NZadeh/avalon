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

        Meteor.call('startGame', this._id, function(err, result) {
            if (err) return Errors.throw(err.reason);

            if (result.notEnoughPlayers) {
                return Errors.throw(
                    'You need more players to start (probably >=5).'
                );
            } else if (result.tooManyPlayers) {
                return Errors.throw(
                    'You have too many players to start (probably >10).'
                );
            } else if (result.success) {
                //ga
                ga('send', 'event', 'game', 'start');
            }
        });
    },
    'click .delete': function(e, tmpl) {
        e.preventDefault();

        Meteor.call('deleteGameRoom', this._id, function(err, result) {
            if (err) return Errors.throw(err.reason);

            if (result.notRoomOwner) {
                return Errors.throw(
                    'Only the room owner can delete this room.'
                );
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
            if (err) return Errors.throw(err.reason);
        });
    },
    'click .leave': function(e, tmpl) {
        // TODO(neemazad): Unify with game_template.js.
        e.preventDefault();

        Meteor.call('removeJoinAuth', function (err, result) {
            if (err) return Errors.throw(err.reason);

            if (result.notLoggedOn) {
                return Errors.throw(
                    'You\'re not logged in.'
                );
            } else if (result.notInRoom) {
                return Errors.throw(
                    'You need to be in a room to leave.'
                );
            } else if (result.success) {
                //ga
                ga('send', 'event', 'game', 'leave');

                Router.go('home');
            }
        });
    }
});