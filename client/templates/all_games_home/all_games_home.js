Template.allGamesHome.helpers({
  addExternalContextForTile(room) {
    const instance = Template.instance();

    const playerAlreadyInside = room.containsUserId(instance.data.playerId);
    const playerInsideAnyGame = instance.data.gameRooms  // This is a collection Cursor
        .map((room) => room.containsUserId(instance.data.playerId))
        .filter(contains => contains)
        .length > 0;

    room.playerLoggedIn = instance.data.loggedIn;
    room.playerAlreadyInside = playerAlreadyInside;
    room.playerInsideAnotherGame = !playerAlreadyInside && playerInsideAnyGame;

    return room;
  },
});
