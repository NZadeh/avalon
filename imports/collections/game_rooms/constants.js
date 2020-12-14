// Unified source of truth -- not directly exported.
const kMerlin = "Merlin";
const kPercival = "Percival";
const kMorgana = "Morgana";
const kAssassin = "Assassin";
const kLoyal = "Loyal Servant";
const kOberon = "Oberon";
const kMinion = "Minion of Mordred";

export const HelperConstants = {
  // NOTE: These values are set to match `GameRooms.schema` field names.
  kRoleField: 'role',           // The key used for the object containing the fields below.
  kRoleNameField: 'roleName',   // The key mapping to a player's role name (e.g. Merlin).
  kRoleKnownInfo: 'knownInfo',  // The key mapping to the string-information a player has.
  kAlignment: 'alignment',      // The key mapping to the player's alignment (e.g. "spies").

  // The possible "values" for kAlignment.
  kResistance: 'Resistance',
  kSpy: 'Spy',

  kMerlin: kMerlin,
  kPercival: kPercival,
  kMorgana: kMorgana,
  kAssassin: kAssassin,
  kLoyal: kLoyal,
  kOberon: kOberon,
  kMinion: kMinion,

  kAllowedRoleNames: [
    kMerlin,
    kPercival,
    kMorgana,
    kAssassin,
    kLoyal,
    kOberon,
    kMinion,
  ],

  kMinPlayers: 2,   // The minimum number of players required to start a game.
  kMaxPlayers: 10,  // The maximum number of players allowed in a game.

  kNoRoomId: false,  // Using "false" to represent the room ID of not being in a room

  kDisabledButtonClass: "disabled-avalon",  // Specified in custom_materialize.css


  // An empty function to be passed as callbacks to Meteor.Collection
  // operations that do not require blocking. (Optimization.)
  // See `callback` argument here:
  // https://docs.meteor.com/api/collections.html#Mongo-Collection-update
  makeAsyncCallback: function(unusedErr, unusedId) {/* do nothing*/},
  // Can be required to reach the "callback" parameter in some
  // Meteor.Collection function calls.
  emptyOptions: {},
};
