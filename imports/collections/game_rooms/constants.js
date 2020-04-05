export const HelperConstants = {
  // NOTE: These values are set to match `GameRooms.schema` field names.
  kRoleField: 'role',           // The key used for the object containing the fields below.
  kRoleNameField: 'roleName',   // The key mapping to a player's role name (e.g. Merlin).
  kRoleKnownInfo: 'knownInfo',  // The key mapping to the string-information a player has.
  kAlignment: 'alignment',      // The key mapping to the player's alignment (e.g. "spies").

  // The possible "values" for kAlignment.
  kResistance: "Resistance",
  kSpy: "Spy",
  kMerlin: "Merlin",

  kMinPlayers: 2,   // The minimum number of players required to start a game.
  kMaxPlayers: 10,  // The maximum number of players allowed in a game.

  kNoRoomId: false,  // Using "false" to represent the room ID of not being in a room

  kDisabledButtonClass: "disabled-avalon",  // Specified in custom_materialize.css
};
