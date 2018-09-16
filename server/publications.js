import { GameRooms } from '/lib/collections/game_rooms/game_rooms';
import { SecretInfo } from '/lib/collections/game_rooms/secret_info';
import SimpleSchema from 'simpl-schema';

// Publish our extended Meteor.users info for use by client-code.
Meteor.publish('userData', function() {
    return Meteor.users.find({_id: this.userId}, {
        fields: {'currentGameRoom': 1}
    });
});

Meteor.publish('gameRooms', function() {
    return GameRooms.find({});
});

Meteor.publish('singleGameRoom', function(roomId) {
    new SimpleSchema({
      roomId: {type: String}
    }).validate({ roomId });

    return GameRooms.find({_id: roomId});
});

Meteor.publish('playerSecretInfo', function() {
    // Note that by using `this.userId`, we ensure that this information is only
    // accessible to the logged in user. No other players' role information is
    // ever sent from the server to this user.
    return SecretInfo.find({ playerId: this.userId });
});
