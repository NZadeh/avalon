import { GameRooms } from '/lib/collections/game_rooms/game_rooms';

export const Permissions = {
  activeUserIsInGameRoom: function(roomId) {
    if (!Meteor.userId()) {
        return false;  // Logged out implies not in a room.
    }

    const gameRoom = GameRooms.findOne({_id: roomId}, {
        fields: {players: 1}
    });

    if (!gameRoom || !gameRoom.players) {
      // The user may not be subscribed to this data, in which case they're definitely not in.
      return false;
    }

    var playerIds = gameRoom.players.map(player => player._id);
    return playerIds.indexOf(Meteor.userId()) !== -1;
  },

  isRoomOwner: function(gameRoom) {
    return Meteor.userId() && Meteor.userId() === gameRoom.ownerId;
  },
};
