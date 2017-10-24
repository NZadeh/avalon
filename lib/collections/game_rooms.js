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
        var whatPlayerKnows = "";

        knownPlayers = 
            knownRoleNames.map(function(roleName) {
                // Get players belonging to each known role.
                return roleToPlayersVec.get(roleName) || [];
            }).reduce(function(players1, players2) {
                // There may be multiple players for a given role.
                // We flatten the players arrays into a single one. 
                return players1.concat(players2);
              },
              /*initialValue=*/[]
            ).filter(function(name) {
                // Avoid a player's "knowing" themself. :)
                return name != player.username;
            });

        player[kRoleField][kRoleKnownInfo] = playerRole.formatPlayerKnowledge(knownPlayers);
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

Meteor.methods({
    'addGameRoom': function(gameRoomInfo) {
        check(Meteor.userId(), String);
        check(gameRoomInfo, {
            title: String,
            password: String,
            passwordProtected: Boolean
        });

        var user = Meteor.user();
        var currRoomId = !!user.profile ? user.profile.currentGameRoom : false;
        var leftAt = !!user.profile ? user.profile.leftAt : false;
        if (!!currRoomId || !!leftAt) {
            return {
                alreadyInRoom: true
            };
        }

        gameRoomInfo.minPlayers = kMinPlayers;
        gameRoomInfo.maxPlayers = kMaxPlayers;

        var gameRoom = _.extend(gameRoomInfo, {
            userId: user._id,
            author: user.username,
            players: [{
                _id: user._id,
                username: user.username
            }],
            open: true,
            createdAt: new Date()
        });

        var gameRoomId = GameRooms.insert(gameRoom);
        Meteor.users.update({_id: Meteor.userId()}, {
            $set: {
                'profile.currentGameRoom': gameRoomId,
                'profile.leftAt': false
            }
        });

        return {
            _id: gameRoomId
        }
    },

    'deleteGameRoom': function(roomId) {
        check(roomId, String);
        check(Meteor.userId(), String);

        var room = GameRooms.findOne(roomId);
        if (isRoomOwner(room)) {
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
        } else {
            return {
                notRoomOwner: true
            };
        }
    },

    'joinGameRoom': function(roomId, password) {
        check(roomId, String);
        check(password, String);

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


        var gameRoom = GameRooms.findOne({_id: roomId});
        if (gameRoom.players.length >= kMaxPlayers) {
            return {
                isAtCapacity: true
            };
        } else if (!gameRoom.open) {
            return {
                alreadyStarted: true
            }
        } else if (password !== gameRoom.password) {
            return {
                wrongPassword: true
            };
        } else {
            //not at capacity, not already in a room, correct password
            //so they're good to go!
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
            }
        }
    },

    'leaveRoom': function() {
        var user = Meteor.user();
        if (!user) return;

        var currRoomId = !!user.profile ? user.profile.currentGameRoom : false;
        var leftAt = !!user.profile ? user.profile.leftAt : false;
        if (!!leftAt) return; //already left; don't do anything
        var numRooms = GameRooms.find(currRoomId).count();
        if (numRooms > 0) { //they're leaving an actual room
            Meteor.users.update({_id: Meteor.userId()}, {
                $set: {
                    'profile.currentGameRoom': false,
                    'profile.leftAt': +new Date()
                }
            });
        } else { //the room they're leaving doesn't exist
            Meteor.users.update({_id: Meteor.userId()}, {
                $set: {
                    'profile.currentGameRoom': false,
                    'profile.leftAt': false
                }
            });
        }
    },

    'removeJoinAuth': function() {
        return removeUserFromGame(Meteor.user());
    },

    'kickPlayer': function(kickedId) {
        check(kickedId, String);

        return removeUserFromGame(Meteor.users.findOne(kickedId));
    },

    'startGame': function(roomId) {
        check(roomId, String);

        var gameRoom = GameRooms.findOne(roomId);
        if (gameRoom.userId !== Meteor.userId()) {
            return {
                notRoomOwner: true
            };
        }

        GameRooms.update(roomId, {
            $set: {
                open: false,
            }
        });

        // Get the room again once it's closed (in case people have since joined)
        gameRoom = GameRooms.findOne(roomId);
        var players = gameRoom.players;

        if (players.length < kMinPlayers) {
            return { notEnoughPlayers: true };
        }
        if (players.length > kMaxPlayers) {
            return { tooManyPlayers: true };
        }

        assignRolesToPlayersInPlace(players);

        GameRooms.update({_id: roomId},
            { $set: { players: players },
        });

        return {
            success: true
        };
    },
    
    'backToLobby': function(roomId) {
        check(roomId, String);

        var gameRoom = GameRooms.findOne(roomId);
        var userId = Meteor.userId();
        if (gameRoom.userId !== userId) {
            return {
                notRoomOwner: true
            };
        }

        var players = gameRoom.players;
        clearPlayerRolesInPlace(players);
        
        GameRooms.update({_id: roomId},
            { $set: { players: players },
        });
    
        GameRooms.update(roomId, {
            $set: {
                open: true,  // more people can join in same lobby
            }
        });

        return {
            success: true
        };
    }
});
