import './all_games_lobby.html';

import '/imports/ui/all_games_lobby/components/account_form.js';
import '/imports/ui/all_games_lobby/components/create_game_room.js';
import '/imports/ui/all_games_lobby/components/game_tile.js';

Template.allGamesLobby.helpers({
  addExternalContextForTile(room) {
    const instance = Template.instance();

    const playerAlreadyInside = room.includesUserId(instance.data.playerId);
    const playerInsideAnyGame = instance.data.gameRooms  // This is a collection Cursor
        .map((room) => room.includesUserId(instance.data.playerId))
        .filter(contains => contains)
        .length > 0;

    room.playerLoggedIn = instance.data.loggedIn;
    room.playerAlreadyInside = playerAlreadyInside;
    room.playerInsideAnotherGame = !playerAlreadyInside && playerInsideAnyGame;

    return room;
  },
});
