import { GameRooms } from '/lib/collections/game_rooms/game_rooms';

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
        if (!activeUserIsInGameRoom(this.params._id)) {
            // For some reason, if the user finds their way to this room without
            // actually being in it (e.g. used hard-coded URL), re-route them back home.
            Router.go('home');
        } else {
            this.next();  // Continue to action (i.e., routing to /room/:_id).
        }
    }
});

// TODO(neemazad): What does this do?
Router.onBeforeAction('dataNotFound');
