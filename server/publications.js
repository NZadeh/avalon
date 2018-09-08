import { GameRooms } from '/lib/collections/game_rooms/game_rooms';
import SimpleSchema from 'simpl-schema';

// TODO(neemazad): What is this for?
Meteor.publish('userData', function() {
    return Meteor.users.find({_id: this.userId}, {
        fields: {'currentGameRoom': 1}
    });
});

Meteor.publish('gameRooms', function() {
    // TODO(neemazad): Limit data to exclude player secret info.
    return GameRooms.find({});
});

Meteor.publish('singleGameRoom', function(roomId) {
    new SimpleSchema({
      roomId: {type: String}
    }).validate({ roomId });

    // TODO(neemazad): Limit data to exclude player secret info
    return GameRooms.find({_id: roomId});
});

Meteor.publish('playerSpecificInGameInfo', function(roomId) {
    new SimpleSchema({
      roomId: {type: String}
    }).validate({ roomId });

    // TODO(neemazad): Refine the query to get just the player's info...
    // and refine the query above not to return it?
    return GameRooms.find({_id: roomId});
});
