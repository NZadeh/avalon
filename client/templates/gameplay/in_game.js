import { GameRooms } from '/lib/collections/game_rooms/game_rooms';
import { HelperConstants } from '/lib/collections/game_rooms/constants';
import { Callbacks } from '/lib/utils/callbacks';
import { Permissions } from '/lib/utils/permissions';

import {
  removeSelf,
  backToLobby,
} from '/lib/collections/game_rooms/methods';

Template.inGame.helpers({
    isRoomOwner: function() {
        return Permissions.isRoomOwner(this);
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
            title: rawData.title,
            known: {
                name: player.username,
                role: player[HelperConstants.kRoleField][HelperConstants.kRoleNameField],
                info: player[HelperConstants.kRoleField][HelperConstants.kRoleKnownInfo],
            },
        };
    },

    playersList: function() {
        // TODO(neemazad): limit info from this query
        var rawData = GameRooms.findOne(this._id, {
            fields: {
                players: 1,  // Array of {ids,usernames,role}
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
                players: 1,  // Array of {id,username,role}
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

Template.inGame.events({
    'click .leave-btn': function(e, tmpl) {
        e.preventDefault();

        if (confirm('Are you sure you want to leave? This may (indirectly) reveal your role. You cannot rejoin the same game.')) {
            removeSelf.call(Callbacks.leftGame);
        }
    },

    'click .back-to-lobby-btn': function(e, tmpl) {
        e.preventDefault();

        if (confirm('This will put everyone back into the lobby. (Role assignments will be lost.) Are you sure you want to leave?')) {
            var roomId = tmpl.data._id;  // See game_room_page.js template event functions for info on this.
            backToLobby.call({ roomId }, (err, result) => {
                if (err) {
                    Materialize.toast(err.reason, 3000, 'error-toast');
                    return;
                }

                if (result.notRoomOwner) {
                    Materialize.toast('You must be the room owner.', 3000, 'error-toast');
                    return;
                } else if (result.success) {
                    // TODO(neemazad): May need to route somewhere once the game is different from the lobby.
                } else {
                    Materialize.toast('Unknown error. (Nothing happened... Log off and log back on?)', 3000, 'error-toast');
                    return;
                }
            });
        }
    }
});
