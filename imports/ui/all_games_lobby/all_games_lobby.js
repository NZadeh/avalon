import './all_games_lobby.html';

import '/imports/ui/all_games_lobby/components/account_form.js';
import '/imports/ui/all_games_lobby/components/create_game_room.js';
import '/imports/ui/all_games_lobby/components/game_tile.js';

import { HelperConstants } from '/imports/collections/game_rooms/constants';

Template.allGamesLobby.helpers({
  addExternalContextForTile(room) {
    const instance = Template.instance();
    const playerId = instance.data.playerId;
    const user = Meteor.users.findOne({_id: playerId});

    const playerAlreadyInside = room.includesUserId(playerId);
    const playerLeftButCanReturn = user &&
                                   user.currentGameRoomId == HelperConstants.kNoRoomId &&
                                   user.previousGameRoomIds &&
                                   user.previousGameRoomIds.includes(room._id);
    const playerInsideAnyGame = instance.data.gameRooms  // This is a collection Cursor
        .map((room) => room.includesUserId(playerId))
        .filter(contains => contains)
        .length > 0;

    room.playerLoggedIn = instance.data.loggedIn;
    room.playerAlreadyInside = playerAlreadyInside;
    room.playerLeftButCanReturn = playerLeftButCanReturn;
    room.playerInsideAnotherGame = !playerAlreadyInside && playerInsideAnyGame;
    return room;
  },
});
