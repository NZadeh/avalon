import './template_single_game.html';

import { FlowRouter } from 'meteor/kadira:flow-router';
import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';

import { GameRooms } from '/imports/collections/game_rooms/game_rooms';
import { SecretInfo, secretInfoUniqueId } from '/imports/collections/game_rooms/secret_info';
import { HelperMethods } from '/imports/collections/game_rooms/methods_helper';
import { Permissions } from '/imports/utils/permissions';

import '/imports/ui/single_game/game_lobby.js';
import '/imports/ui/single_game/in_game.js';


Template.Template_singleGame.onCreated(function singleGameOnCreated() {
  this.getRoomId = () => FlowRouter.getParam('_id');

  this.autorun(() => {
    this.subscribe('singleGameRoom', this.getRoomId());
  });
});

Template.Template_singleGame.helpers({
  gameStarted() {
    const instance = Template.instance();
    const gameRoom = GameRooms.findOne({_id: instance.getRoomId()}, { fields: { open: 1 } });
    return gameRoom && !gameRoom.open  // If there is no gameRoom, this should return false.
  },

  lobbyContext() {
    const instance = Template.instance();
    var gameRoom = GameRooms.findOne(instance.getRoomId());

    // Reasons we may need to route the user away:
    // (note, this runs reactively if gameRoom changes)
    // - The room was deleted while the user was inside
    // - The user was kicked from the room...
    // - The user is not in this room but they know the URL/room id for some reason.
    // Ideally, we would give error messages, but it is rather difficult to differentiate
    // the different "states" (causes listed above) without active state tracking.
    // TODO(neemazad): We could add state tracking (using `userData`) if we want to give
    // informative "error" or "update" messages why a user was redirected. :)
    const gameRoomUnavailable = instance.subscriptionsReady() && !gameRoom;
    const playerNotInRoom = instance.subscriptionsReady() && gameRoom && 
                            !gameRoom.includesUserId(Meteor.userId());
    const shouldRedirectHome = gameRoomUnavailable || playerNotInRoom;
    if (shouldRedirectHome) {
      FlowRouter.go('home');
      // Meanwhile, return a not-ready so that in the split second between when the user
      // is actually routed home and while this code is still running (and
      // the template rendering), the template does not try to access fields
      // from the recently-deleted or inaccessible room.
      return { gameRoomReady: false };
    }

    return {
      gameRoomReady: instance.subscriptionsReady(),
      gameRoom: gameRoom,
      isRoomOwner: Permissions.isRoomOwner(gameRoom),
    };
  },

  inGameContext() {
    const instance = Template.instance();
    const gameRoom = GameRooms.findOne(
      { _id: instance.getRoomId() },
      { fields: { players: 1, title: 1, ownerId: 1, inGameInfoId: 1 } }
    );
    // If we're not finding the data, may as well return not-ready.
    // For a similar reason as above, returning not-ready doubles as protection in the
    // event the user is on the way out of a room but is still trying to render data
    // after they have lost access to it...
    if (!gameRoom) { return { inGameReady: false }; }

    var player = gameRoom.players.find(function(player) {
      return player._id === Meteor.userId();
    });
    if (!player) { 
      // If the player is not in the room and they have all the data,
      // they're not a player in the game and should be redirected home.
      if (instance.subscriptionsReady()) {
        FlowRouter.go('home');
      }
      return { inGameReady: false };
    }

    const secretInfo = SecretInfo.findOne({
        uniqueId: secretInfoUniqueId(player._id, gameRoom._id)
    });
    if (!secretInfo) { return { inGameReady: false }; }

    const inGameInfo = gameRoom.inGameInfo();
    if (!inGameInfo) { return { inGameReady: false }; }

    const seatingOrderMap = inGameInfo.seatingOrderMap();
    const properlyOrderedPlayers = gameRoom.players
        .sort((player1, player2) => 
                seatingOrderMap.get(player1._id) - seatingOrderMap.get(player2._id));

    var playerIdToAllInfoMap = new Map();
    gameRoom.players.forEach(player => {
      playerIdToAllInfoMap.set(player._id, /* empty for now */{});
    });

    // All players on proposal
    inGameInfo.selectedOnMission.forEach(id => {
      playerIdToAllInfoMap.get(id).onProposal = true;
    });
    // All players on assassination list
    inGameInfo.selectedForAssassination.forEach(id => {
      playerIdToAllInfoMap.get(id).onAssassinationList = true;
    });
    // All absent players
    gameRoom.players.filter(player => player.gone).forEach(player => {
      playerIdToAllInfoMap.get(player._id).absent = true;
    })
    // Mark self (for special rendering)
    playerIdToAllInfoMap.get(Meteor.userId()).isSelf = true;
    // Mark proposer
    playerIdToAllInfoMap.get(inGameInfo.proposer).isProposer =
        inGameInfo.isProposerState();
    // All remaining proposers (including current) + proposal position
    inGameInfo.remainingProposersForMission().forEach(
      ({id, proposalNum}) => {
        var playerInMap = playerIdToAllInfoMap.get(id);
        playerInMap.mightProposeThisMission = true;
        playerInMap.proposalPosition = proposalNum;
    });
    // All players still needing to act
    inGameInfo.playersNeedingToAct().forEach(id => {
      playerIdToAllInfoMap.get(id).isBlocking = true
    });
    // Player vote history
    const voteIdToPlayerIdMap = new Map(
          // Invert this map.
          Array.from(inGameInfo.playerIdToVoteHistoryIdMap(),
                     a => a.reverse()));
    const allVoteObjects = inGameInfo.allPlayerVoteHistoryCursor();
    allVoteObjects.forEach(function(voteObject) {
      const voteId = voteObject._id;
      const playerId = voteIdToPlayerIdMap.get(voteId);
      const missions = voteObject.missions;

      playerIdToAllInfoMap.get(playerId).allVotes = missions;
    });

    var orderedNameToAllInfoMap = new Map();
    var idToUsername = new Map();  // "grab this" for use later
    properlyOrderedPlayers.forEach(function(player) {
      orderedNameToAllInfoMap.set(
          player.username,
          playerIdToAllInfoMap.get(player._id));
      // While we already have this data, grab it for use below later.
      idToUsername.set(player._id, player.username);
    });

    // NOTE: We *cannot* use maps for the task below, since the roles are not
    // unique. This is the cost of annotating role names with players, rather
    // than doing it the other way around.
    const rolesWithTeam = 
        HelperMethods.roleNamesForNPlayerGame(gameRoom.players.length)
                     .sort();

    var roleList = [];

    if (inGameInfo.isProposerState()) {
      // We just need "role" fields until roles are revealed.
      roleList = rolesWithTeam.map(
        roleNameTeam => ({role: roleNameTeam})
      );
    } else {
      // Once the proposals are done, we should have some revealed roles to
      // display. Note that the Assassin might be revealed alone, first.
      const rolesAndNames = inGameInfo.playersInGame.map(player => ({
        role: player.roleIfRevealed,
        name: idToUsername.get(player._id),
        attributed: false, // since roles are not unique, attribute 1 at a time
      }));

      roleList = rolesWithTeam.map(roleNameTeam => {
        const index = rolesAndNames.findIndex(
            elem => !elem.attributed && elem.role === roleNameTeam);

        var name = undefined;
        if (index >= 0) {
          rolesAndNames[index].attributed = true;
          name = rolesAndNames[index].name;
        }
        
        return {
          role: roleNameTeam,
          name: name,
        };
      });
    }

    return {
      inGameReady: instance.subscriptionsReady(),
      title: gameRoom.title,
      ownerId: gameRoom.ownerId,
      roomId: gameRoom._id,
      isRoomOwner: Permissions.isRoomOwner(gameRoom),
      isProposer: Meteor.userId() === inGameInfo.proposer &&
                  // Prevent refreshes during non-proposer times
                  // from triggering the proposer pop-up
                  inGameInfo.isProposerState(),
      isAssassin: inGameInfo.isKnownAssassin(Meteor.userId()),
      known: {
        name: player.username,
        role: secretInfo.roleName,
        info: secretInfo.roleInfo,
      },
      roleList: roleList,
      orderedNameToAllInfoMap: orderedNameToAllInfoMap,
      // TODO(neemazad): Look to see whether we should pass in specific
      // inGameInfo fields instead of this object, as we're partially doing
      // that already.
      inGameInfo: inGameInfo,  // almost all info in this object needs to be rendered
    };
  },
});
