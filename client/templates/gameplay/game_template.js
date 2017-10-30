Template.gameTemplate.helpers({
    isRoomOwner: function() {
        return isRoomOwner(this);
    },

    gameData: function() {
        var rawData = GameRooms.findOne(this._id, {
            fields: {
                title: 1,
                players: 1,
            }
        });
        if (!rawData) return { title: 'Error in creating game...! Missing title and player info.'};

        var player = rawData.players.find(function(player) {
            return player._id === Meteor.userId();
        });
        if (!player) return {title: 'You appear not to be in the game... Try going back and rejoining.'}

        return {
            title: rawData.title || 'Unnamed game of Avalon',
            known: {
                name: player.username,
                role: player.role.roleName,
                info: player.role.knownInfo,
            },
        };
    },

    playersList: function() {
        // TODO(neemazad): limit info from this query
        var rawData = GameRooms.findOne(this._id, {
            fields: {
                players: 1, //array of {ids,usernames,role}
            }
        });

        if (!rawData || !rawData.players) return [];

        var playerList = [];
        
        for (var pi = 0; pi < rawData.players.length; pi++) {
            var playersId = rawData.players[pi]._id;
            playerList.push({
                username: rawData.players[pi].username,
            });
        }
        return playerList;
    },

    roleList: function() {
        var rawData = GameRooms.findOne(this._id, {
            fields: {
                players: 1, //array of {id,username,role}
            }
        });

        if (!rawData || !rawData.players) return [];

        var players = rawData.players;
        var roleList = [];

        for (var ri = 0; ri < players.length; ri++) {
            var roleName = players[ri].role.roleName;
            roleList.push({
                role: roleName
            });
        }

        // Sort to remove any order information.
        roleList = roleList.sort(function(roleFirst, roleSecond) {
            // Appears to be alphabetical order.
            return roleFirst.role > roleSecond.role;
        });
        return roleList;
    }
});

Template.gameTemplate.events({
    'click #leave-btn': function(e, tmpl) {
        e.preventDefault();

        if (confirm('Are you sure you want to leave? This may (indirectly) reveal your role. You cannot rejoin the same game.')) {
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
    },

    'click #back-to-lobby-btn': function(e, tmpl) {
        e.preventDefault();

        if (confirm('This will put everyone back into the lobby. (Role assignments will be lost.) Are you sure you want to leave?')) {
            var roomId = this._id;
            Meteor.call('backToLobby', roomId, function (err, result) {
                if (err) return Errors.throw(err.reason);

                if (result.notRoomOwner) {
                    return Errors.throw(
                        'You must be the room owner.'
                    );
                } else if (result.success) {
                    //ga
                    ga('send', 'event', 'game', 'backtolobby');
                } else {
                    return Errors.throw(
                        'Unknown error. (Nothing happened... Log off and log back on?)'
                    );
                }
            });
        }
    }
});
