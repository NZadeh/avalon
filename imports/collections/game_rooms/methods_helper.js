import { GameRooms } from '/imports/collections/game_rooms/game_rooms';
import { HelperConstants } from '/imports/collections/game_rooms/constants';
import { InGameInfo } from '/imports/collections/game_rooms/in_game_info.js';

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
  nameTeam() { return this.name() + " (" + this.team() + ")"; }
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

const kMissionCounts = [
  [2, 3, 2, 3, 3],  // 5-player
  [2, 3, 4, 3, 4],  // 6-player
  [2, 3, 3, 4, 4],  // 7-player
  [3, 4, 4, 5, 5],  // 8-player
  [3, 4, 4, 5, 5],  // 9-player
  [3, 4, 4, 5, 5],  // 10-player
];

var missionCountsForNPlayers = function(num_players) {
  // ** For testing: **
  if (num_players === 2) { return [2, 2, 2, 2, 2]; }
  if (num_players === 3) { return [2, 3, 2, 3, 3]; }
  if (num_players === 4) { return [2, 3, 4, 3, 4]; }
  // ** End: For testing **

  const index = num_players - 5;
  console.assert(0 <= index && index < missionCounts.length,
                 "Unknown mission count for num_players: " + num_players);
  return kMissionCounts[num_players - 5];
};

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

/**
 * Removes a user from GameRooms. GameRooms should handle automatically
 * updating or deleting any data associated with that player, e.g.
 * voting history and other in-game data.
 */
var removeUserIdFromRoom = function(userId, roomId) {
  var gameRoom = GameRooms.findOne(roomId);
  if (!gameRoom) {
    return;  // Somehow, the room doesn't exist...
  }
  GameRooms.update(
    {_id: roomId},
    { $pull: { players: {_id: userId} } },
    { multi: true }
  );

  // If the room became empty, we can delete the room. Otherwise,
  // arbitrarily choose a new owner.
  // TODO(neemazad): Give players a way of passing room ownership as well.
  gameRoom = GameRooms.findOne({_id: roomId}); //updated
  var players = gameRoom.players;
  if (players.length === 0) {
    // Last player in the room just left.
    GameRooms.remove({_id: roomId});
  } else {
    // Otherwise, choose a new owner.
    var newOwner = players[0];
    var newOwnerInfo = {
      ownerId: newOwner._id,
      author: newOwner.username
    };

    GameRooms.update({_id: roomId}, {$set: newOwnerInfo});
  }
};

export const HelperMethods = {
  /**
   * Returns a map that, for each player in `players`, is keyed by player id and
   * maps to an object value that contains the subfields:
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
    var idToRoleInfo = new Map();

    // Give each player a role. Create a reverse look-up from role to player.
    shuffledRoles.forEach(function(role, index) {
      // Map a player id to the role name.
      var roleInfo = {}
      roleInfo[HelperConstants.kRoleNameField] =  role.nameTeam();
      idToRoleInfo.set(players[index]._id, roleInfo);
      
      // Map the role name to the player name.
      appendToMapForKey(roleToPlayersVec, role.name(), players[index].username);
    });

    // Give each player the info they learn at night, based on others' roles.
    players.forEach(function(player, index) {
      const playerRole = shuffledRoles[index];
      console.assert(idToRoleInfo.get(player._id)[HelperConstants.kRoleNameField].includes(playerRole.name()),
          "Attempting to give player info for another player's role...");

      const knownRoleNames = playerRole.knows();
      var knownPlayers = 
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

      idToRoleInfo.get(player._id)[HelperConstants.kRoleKnownInfo] =
          playerRole.formatPlayerKnowledge(shuffledKnown);
    });

    return idToRoleInfo;
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

    const currRoomId = user.currentGameRoomId;
    if (!currRoomId) {
      return {
        notInRoom: true
      };
    }

    removeUserIdFromRoom(user._id, currRoomId);

    return {
      success: true
    };
  },

  /**
   * Returns an array of role-names for an `n` player game of Avalon.
   */
  roleNamesForNPlayerGame(n) {
    n = Math.min(n, kOrderedRolesArray.length);
    return kOrderedRolesArray.slice(0, n).map(role => role.nameTeam());
  },

  /**
   * Return value should be directly insertible into the InGameInfo collection.
   */
  generateStartingInGameInfo(inRoomPlayers) {
    const playerIds = inRoomPlayers.map(function(player) {
      // NOTE: Vote info initialization is handled by InGameInfo collection.
      return {_id: player._id};
    });
    const shuffledIds = shuffleArray(playerIds);
    // Since the array of seating order is shuffled, just choose the first
    // person in "seating order".
    // TODO(neemazad): Track previous Merlin (in backToLobby).
    const proposerId = shuffledIds[0]._id;

    return {
        playersInGame: shuffledIds,
        missionCounts: missionCountsForNPlayers(inRoomPlayers.length),
        currentMissionNumber: 1,
        currentProposalNumber: 1,
        proposer: proposerId,
        selectedOnMission: [/*nobody yet*/],
        proposalVoteInProgress: /*no proposal yet*/false,
        liveVoteTally: [/*starts empty*/],
        missionInProgress: /*no mission yet*/false,
        liveMissionTally: [/*starts empty*/],
        missionOutcomes: [/*none yet*/],
        gamePhase: "inProgress",
    };
  },
};
