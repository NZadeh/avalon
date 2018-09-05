Router.configure({
    layoutTemplate: 'layout',
    notFoundTemplate: 'notFound'
});

Router.route('/', {
    name: 'home',
    template: 'allGamesHome',
    waitOn: function() {
        return [Meteor.subscribe('gameRooms')]
    },
    data: function() {
        return {
            gameRooms: GameRooms.find({}, {
                sort: {
                    passwordProtected: 1,
                    createdAt: -1
                }
            })
        };
    }
});

Router.route('/room/:_id', {
    name: 'gameLobby',
    template: 'gameLobby',
    waitOn: function() {
        return [Meteor.subscribe('singleGameRoom', this.params._id)];
    },
    data: function() {
        return GameRooms.findOne(this.params._id);
    },
    // This is a hook that is called before routing to /room/:_id...
    onBeforeAction: function() {
        // Presumably before this route, state has been updated to put the user
        // into the game-room with id `this.params._id`.
        // TODO(neemazad): This is kind of weird. Is this update happening twice?
        if (isInGameRoom(this.params._id)) {
            Meteor.users.update({_id: Meteor.userId()}, {
                $set: {
                    'profile.currentGameRoom': this.params._id,
                    'profile.leftAt': false
                }
            });
            this.next();  // Continue to action (i.e., routing to /room/:_id).
        } else {
            Router.go('home');
        }
    }
});

Router.onBeforeAction('dataNotFound');
