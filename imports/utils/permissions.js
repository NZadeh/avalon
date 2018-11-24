import { Meteor } from 'meteor/meteor';

import { GameRooms } from '/imports/collections/game_rooms/game_rooms';

export const Permissions = {
  isRoomOwner: function(gameRoom) {
    return Meteor.userId() && gameRoom && Meteor.userId() === gameRoom.ownerId;
  },
};
