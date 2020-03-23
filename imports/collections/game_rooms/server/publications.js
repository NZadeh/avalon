import { Meteor } from 'meteor/meteor';
import SimpleSchema from 'simpl-schema';
import { publishComposite } from 'meteor/reywood:publish-composite';

import { GameRooms } from '/imports/collections/game_rooms/game_rooms';
import { InGameInfo, VoteHistory } from '/imports/collections/game_rooms/in_game_info.js';
import { SecretInfo } from '/imports/collections/game_rooms/secret_info';

// Publish our extended Meteor.users info for use by client-code.
Meteor.publish('userData', function() {
    return Meteor.users.find({_id: this.userId}, {
        fields: {'currentGameRoom': 1}
    });
});

Meteor.publish('gameRooms', function() {
    return GameRooms.find({});
});

// https://atmospherejs.com/reywood/publish-composite
publishComposite('singleGameRoom', function(roomId) {
    new SimpleSchema({
      roomId: {type: String}
    }).validate({ roomId });

    return {
        // First, find the game room. The other publications depend on that.
        find() {
            return GameRooms.find({_id: roomId});
        },
        children: [{
            // Then for each game room, in this case just one, find the in-game
            // information if available.
            find(gameRoom) {
                return InGameInfo.find({_id: gameRoom.inGameInfoId});
            },
            children: [{
                // Then for each info, in this case just one, publish the
                // collective vote history of players in the game.
                find(inGameInfo, gameRoom) {
                    return inGameInfo.allPlayerVoteHistoryCursor();
                },
            }],
        }],
    };
});

Meteor.publish('playerSecretInfo', function() {
    // Note that by using `this.userId`, we ensure that this information is only
    // accessible to the logged in user. No other players' role information is
    // ever sent from the server to this user.
    return SecretInfo.find({ playerId: this.userId });
});
