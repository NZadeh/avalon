import { GameRooms } from '/lib/collections/game_rooms/game_rooms';

export const Permissions = {
  activeUserIsInGameRoom: function(roomId) {
    if (!Meteor.userId()) {
        return false;  // Logged out implies not in a room.
    }

    var players = GameRooms.findOne({_id: roomId}, {
        fields: {players: 1}
    }).players;
    var playerIds = players.map(function(player) {
        return player._id;
    });

    return playerIds.indexOf(Meteor.userId()) !== -1;
  },

  isRoomOwner: function(gameRoom) {
    return Meteor.userId() && Meteor.userId() === gameRoom.ownerId;
  },
};
