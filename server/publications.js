import { GameRooms } from '/lib/collections/game_rooms/game_rooms';
import SimpleSchema from 'simpl-schema';

// TODO(neemazad): What is this for?
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
