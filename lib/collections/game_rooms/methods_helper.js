import { GameRooms } from '/lib/collections/game_rooms/game_rooms';
import { HelperConstants } from '/lib/collections/game_rooms/constants';

const kMerlin = "Merlin";
const kPercival = "Percival";
const kMorgana = "Morgana";
const kAssassin = "Assassin";
const kLoyal = "Loyal Servant";
const kOberon = "Oberon";
const kMinion = "Minion of Mordred";

const kResistance = "Resistance";
const kSpies = "Spy";

const kDefaultKnowNothing = "Nothing about other players.";

class AvalonRole {
  name() { return "no-name"; }
  team() { return "no-team-specified"; }
  knows() { return []; }
  formatPlayerKnowledge(playerNames) { return kDefaultKnowNothing; }
}

class Resistance extends AvalonRole {
  name() { return kLoyal; }
  team() { return kResistance; }
}

class Spy extends AvalonRole {
  name() { return kMinion; }
  team() { return kSpies; }
  knows() { return [kMorgana, kAssassin, kMinion]; }
  formatPlayerKnowledge(playerNames) { 
    return "Your fellow (non-Oberon) spies are "
      + playerNames.join(", ");
  }
}

class Merlin extends Resistance {
  name() { return kMerlin; }
  knows() { return [kMorgana, kAssassin, kMinion, kOberon]; }
  formatPlayerKnowledge(playerNames) { 
    return "The spies are " + playerNames.join(", ");
  }
}

class Percival extends Resistance {
  name() { return kPercival; }
  knows() { return [kMorgana, kMerlin]; }
  formatPlayerKnowledge(playerNames) { 
    return "Merlin and Morgana are " + playerNames.join(" and ")
      + ". (Who is who? You got this, Percy!)";
  }
}

class Morgana extends Spy {
  name() { return kMorgana; }
}

class Assassin extends Spy {
  name() { return kAssassin; }
}

class Oberon extends Spy {
  name() { return kOberon; }
  knows() { return []; }
  formatPlayerKnowledge(playerNames) { return kDefaultKnowNothing; }
}

// The ordering of roles is what determines which roles are added as the game
// size increases.
const kOrderedRolesArray = [
  new Merlin(),
  new Percival(),
  new Morgana(),
  new Assassin(),
  new Resistance(),
  new Resistance(),
  new Oberon(),
  new Resistance(),
  new Resistance(),
  new Spy(),
];

/**
 * From: https://stackoverflow.com/a/12646864
 *
 * Randomize array element order in-place.
 * Using Durstenfeld shuffle algorithm.
 */
var shuffleArray = function(array) {
  for (var i = array.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
  return array;
};

/**
 * Appends value to the end of a vector at map.get(key).
 * Will create a one-element vector if key doesn't already exist.
 */
var appendToMapForKey = function(map, key, value) {
  valueArray = map.get(key) || [];
  valueArray.push(value);
  map.set(key, valueArray);
};


var removeJoinAuth = function(userId, username, roomId) {
  //get rid of their currentGameRoom property
  Meteor.users.update({_id: userId}, {
    $set: {
      'profile.currentGameRoom': false,
      'profile.leftAt': false
    }
  });

  //remove them from the room's player list
  var gameRoom = GameRooms.findOne(roomId);
  if (!gameRoom) {
    return; //no room to remove them from
  }
  GameRooms.update(
    {_id: roomId},
    { $pull: { players: {_id: userId} } },
    { multi: true }
  );

  //check to see if the room is then empty
  gameRoom = GameRooms.findOne({_id: roomId}); //updated
  var players = gameRoom.players;
  if (players.length === 0) {
    //their leaving the room made it empty
    GameRooms.remove({_id: roomId}); //so delete the room
  } else {
    //not empty so choose a new owner
    var newOwner = players[0];
    var updateObj = {
      ownerId: newOwner._id,
      author: newOwner.username
    };

    GameRooms.update({_id: roomId}, {
      $set: updateObj,
    });
  }
};

export const HelperMethods = {
  /**
   * For each player in `players`, adds a key-->value pair
   *   kRoleField --> role 
   * where `role` contains subfields:
   *   kRoleNameField --> <the name of the role, e.g. Merlin>
   *   kRoleKnownInfo --> <the information that player knows about other players>
   */
  assignRolesToPlayers: function(players) {
    var roles = kOrderedRolesArray
      .slice(0, Math.min(players.length, HelperConstants.kMaxPlayers))
      .map(function(role) {
        return role;
      });

    var shuffledRoles = shuffleArray(roles);
    var roleToPlayersVec = new Map();

    // Give each player a role. Create a reverse look-up from role to player.
    shuffledRoles.forEach(function(role, index) {
      players[index][HelperConstants.kRoleField] = {}
      players[index][HelperConstants.kRoleField][HelperConstants.kRoleNameField] =
        role.name() + " (" + role.team() + ")";

      appendToMapForKey(roleToPlayersVec, role.name(), players[index].username);
    });

    // Give each player the info they learn at night, based on others' roles.
    players.forEach(function(player, index) {
      playerRole = shuffledRoles[index];
      console.assert(player[HelperConstants.kRoleField][HelperConstants.kRoleNameField].includes(playerRole.name()),
        "Attempting to give player info for another player's role...");

      knownRoleNames = playerRole.knows();
      knownPlayers = 
        knownRoleNames.map(function(roleName) {
          // Get players belonging to each known role.
          return roleToPlayersVec.get(roleName) || [];
        }).reduce(function(playersVec1, playersVec2) {
          // There may be multiple players for a given role.
          // We flatten the players arrays into a single one. 
          return playersVec1.concat(playersVec2);
          },
          /*initialValue=*/[]
        ).filter(function(name) {
          // Avoid a player's "knowing" themself. :)
          return name != player.username;
        });

      // A critical step, to hide any information from the order of names in the text.
      var shuffledKnown = shuffleArray(knownPlayers);

      player[HelperConstants.kRoleField][HelperConstants.kRoleKnownInfo] = playerRole.formatPlayerKnowledge(shuffledKnown);
    });

    return players;
  },

  /**
   * Removes the role information for each player. (Good for restarting.)
   */
  clearPlayerRolesInPlace: function(players) {
    players.forEach(function(player) {
      delete player[HelperConstants.kRoleField];
    });
  },

  /**
   * Removes the user from whatever game they are currently in, if they are in one.
   */
  removeUserFromGame: function(user) {
    if (!user) {
      return {
        notLoggedOn: true
      };
    };

    var currRoomId = !!user.profile ? user.profile.currentGameRoom : false;
    if (!currRoomId) {
      return {
        notInRoom: true
      };
    }

    removeJoinAuth(user._id, user.username, currRoomId);

    return {
      success: true
    };
  },
};