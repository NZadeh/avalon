// TODO(neemazad): Write the code in a way that these imports become necessary.
// i.e. better project structure.  https://guide.meteor.com/structure.html
import { Meteor } from 'meteor/meteor';
import { ValidatedMethod } from 'meteor/mdg:validated-method';
import { SimpleSchema } from 'meteor/aldeed:simple-schema';

GameRooms = new Meteor.Collection('gameRooms')

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


// neemazad added constants :)
// must line up with expectations in game_template.js
const kRoleField = 'role';
const kRoleNameField = 'roleName';
const kRoleKnownInfo = 'knownInfo';

const kMinPlayers = 2; // for testing TODO(neemazad): revert to 5
const kMaxPlayers = 10;

/**
 * From: https://stackoverflow.com/a/12646864
 *
 * Randomize array element order in-place.
 * Using Durstenfeld shuffle algorithm.
 */
shuffleArray = function(array) {
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
appendToMapForKey = function(map, key, value) {
  valueArray = map.get(key) || [];
  valueArray.push(value);
  map.set(key, valueArray);
};

/**
 * For each player in `players`, adds a key-->value pair
 *   kRoleField --> role 
 * where `role` contains subfields:
 *   kRoleNameField --> <the name of the role, e.g. Merlin>
 *   kRoleKnownInfo --> <the information that player knows about other players>
 */
assignRolesToPlayersInPlace = function(players) {
  var roles = kOrderedRolesArray
    .slice(0, Math.min(players.length, kMaxPlayers))
    .map(function(role) {
      return role;
    });
    
  var shuffledRoles = shuffleArray(roles);
  var roleToPlayersVec = new Map();

  // Give each player a role. Create a reverse look-up from role to player.
  shuffledRoles.forEach(function(role, index) {
    players[index][kRoleField] = {}
    players[index][kRoleField][kRoleNameField] =
      role.name() + " (" + role.team() + ")";

    appendToMapForKey(roleToPlayersVec, role.name(), players[index].username);
  });

  // Give each player the info they learn at night, based on others' roles.
  players.forEach(function(player, index) {
    playerRole = shuffledRoles[index];
    console.assert(player[kRoleField][kRoleNameField].includes(playerRole.name()),
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

    player[kRoleField][kRoleKnownInfo] = playerRole.formatPlayerKnowledge(shuffledKnown);
  });
};

/**
 * Removes the role information for each player. (Good for restarting.)
 */
clearPlayerRolesInPlace = function(players) {
  players.forEach(function(player) {
    delete player[kRoleField];
  });
};

removeJoinAuth = function(userId, username, roomId) {
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
      userId: newOwner._id,
      author: newOwner.username
    };

    GameRooms.update({_id: roomId}, {
      $set: updateObj,
    });
  }
};

removeUserFromGame = function(user) {
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
};

export const addGameRoom = new ValidatedMethod({
  name: 'avalon.addGameRoom',

  validate: new SimpleSchema({
    title: { type: String },
    password: { type: String },
    passwordProtected: { type: Boolean }
  }).validator(),

  run({ title, password, passwordProtected }) {
    var user = Meteor.user();
    var currRoomId = !!user.profile ? user.profile.currentGameRoom : false;
    var leftAt = !!user.profile ? user.profile.leftAt : false;
    if (!!currRoomId || !!leftAt) {
      return {
        alreadyInRoom: true
      };
    }

    var gameRoom = {
      // User inputs
      title: title,
      password: password,
      passwordProtected: passwordProtected,
      // Programmatic inputs
      minPlayers: kMinPlayers,
      maxPlayers: kMaxPlayers,
      userId: user._id,
      author: user.username,
      players: [{
        _id: user._id,
        username: user.username
      }],
      open: true,
      createdAt: new Date()
    };

    var gameRoomId = GameRooms.insert(gameRoom);
    Meteor.users.update({_id: user._id}, {
      $set: {
        'profile.currentGameRoom': gameRoomId,
        'profile.leftAt': false
      }
    });

    return {
      _id: gameRoomId
    };
  },
});

export const deleteGameRoom = new ValidatedMethod({
  name: 'avalon.deleteGameRoom',

  validate: new SimpleSchema({
    roomId: { type: String }
  }).validator(),

  run({ roomId }) {
    var room = GameRooms.findOne(roomId);
    if (!isRoomOwner(room)) {
      return {
        notRoomOwner: true
      };
    }

    var players = room.players || [];
    players.map(function(player) {
      Meteor.users.update({_id: player._id}, {
        $set: {
          'profile.currentGameRoom': false,
          'profile.leftAt': false
        }
      });
    });
    GameRooms.remove(roomId);

    return {
      success: true
    };
  },
});

export const joinRoom = new ValidatedMethod({
  name: 'avalon.joinRoom',

  validate: new SimpleSchema({
    roomId: { type: String },
    password: { type: String }
  }).validator(),

  run({ roomId, password }) {
    var user = Meteor.user();
    if (!user) {
      return {
        notLoggedOn: true
      };
    }

    var currRoomId = !!user.profile ? user.profile.currentGameRoom : false;
    var leftAt = !!user.profile ? user.profile.leftAt : false;
    if (!!currRoomId || !!leftAt) {
      return {
        alreadyInRoom: true
      };
    } 

    // TODO(neemazad): Consider locking the room here from further joins...
    // Would that prevent a lot of quick entries? Maybe we want to "wait"
    // instead, like a mutex?
    var gameRoom = GameRooms.findOne({_id: roomId});
    if (gameRoom.players.length >= kMaxPlayers) {
      return {
        isAtCapacity: true
      };
    } else if (!gameRoom.open) {
      return {
        alreadyStarted: true
      };
    } else if (password !== gameRoom.password) {
      return {
        wrongPassword: true
      };
    }

    GameRooms.update({_id: roomId}, {
      $addToSet: {
        players: {
          _id: Meteor.userId(),
          username: Meteor.user().username
        }
      }
    });

    Meteor.users.update({_id: Meteor.userId()}, {
      $set: {
        'profile.currentGameRoom': roomId,
        'profile.leftAt': false
      }
    });

    return {
      success: true
    };
  },
});

// TODO(neemazad): What happens if a client programmatically sends startGame requests...?
// Do we need to guard against that?
export const startGame = new ValidatedMethod({
  name: 'avalon.startGame',

  validate: new SimpleSchema({
    roomId: { type: String }
  }).validator(),

  run({ roomId }) {
    var gameRoom = GameRooms.findOne(roomId);
    if (gameRoom.userId !== Meteor.userId()) {
      return {
        notRoomOwner: true
      };
    }

    var inRoomPlayers = gameRoom.players;

    if (inRoomPlayers.length < kMinPlayers) {
      return { notEnoughPlayers: true };
    } else if (inRoomPlayers.length > kMaxPlayers) {
      return { tooManyPlayers: true };
    }

    assignRolesToPlayersInPlace(inRoomPlayers);

    GameRooms.update({_id: roomId}, {
      $set: { 
        players: inRoomPlayers, 
        open: false
      }
    });

    return {
      success: true
    };
  },
});

// A more specific version of the method below, for security purposes.
// Uses Meteor.user() directly to prevent malicious users from removing
// other users :)
export const removeSelf = new ValidatedMethod({
  name: 'avalon.removeSelf',

  validate: null,

  run() {
    return removeUserFromGame(Meteor.user());
  },
});

export const removePlayer = new ValidatedMethod({
  name: 'avalon.removePlayer',

  validate: new SimpleSchema({
    removedId: { type: String }
  }).validator(),

  run({ removedId }) {
    // TODO(neemazad): Check here that the person trying to remove is either
    //   1. self (though, really, that should be the method above)
    //   2. the owner of the room in which the removedId is a player
    return removeUserFromGame(Meteor.users.findOne(removedId));
  },
});

export const backToLobby = new ValidatedMethod({
  name: 'avalon.backToLobby',

  validate: new SimpleSchema({
    roomId: { type: String }
  }).validator(),

  run({ roomId }) {
    var gameRoom = GameRooms.findOne(roomId);
    var userId = Meteor.userId();
    if (gameRoom.userId !== userId) {
      return {
        notRoomOwner: true
      };
    }

    var inRoomPlayers = gameRoom.players;
    clearPlayerRolesInPlace(inRoomPlayers);
    
    GameRooms.update({_id: roomId}, {
      $set: {
        players: inRoomPlayers,
        open: true
      }
    });

    return {
      success: true
    };
  },
});
