import './template_single_game.html';

import { FlowRouter } from 'meteor/kadira:flow-router';
import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';

import { GameRooms } from '/imports/collections/game_rooms/game_rooms';
import { SecretInfo } from '/imports/collections/game_rooms/secret_info';
import { HelperMethods } from '/imports/collections/game_rooms/methods_helper';
import { Permissions } from '/imports/utils/permissions';

import '/imports/ui/single_game/game_lobby.js';
import '/imports/ui/single_game/in_game.js';

Template.Template_singleGame.onCreated(function singleGameOnCreated() {
  this.getRoomId = () => FlowRouter.getParam('_id');

  this.autorun(() => {
    this.subscribe('singleGameRoom', this.getRoomId());
    this.subscribe('playerSecretInfo');
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
    if (!player) { return { inGameReady: false }; }

    const secretInfo = SecretInfo.findOne({ playerId: player._id });
    if (!secretInfo) { return { inGameReady: false }; }

    const inGameInfo = gameRoom.inGameInfo();
    if (!inGameInfo) { return { inGameReady: false }; }

    const seatingOrderMap = gameRoom.seatingOrderMap();
    const properlyOrderedPlayerNames = gameRoom.players
        .sort((player1, player2) => 
                seatingOrderMap.get(player1._id) - seatingOrderMap.get(player2._id))
        .map(player => player.username);
    const currentlyProposed = inGameInfo.selectedOnMission.map(id => gameRoom.idToName(id));

    const voteIdToPlayerIdMap = new Map(
          // Invert this map.
          Array.from(inGameInfo.playerIdToVoteHistoryIdMap(),
                     a => a.reverse()));
    var nameToVotesMap = new Map(); // Fill in a map of string name to vote history arrays.

    const allVoteObjects = inGameInfo.allPlayerVoteHistoryCursor().fetch();
    allVoteObjects.forEach(function(voteObject) {
      const voteId = voteObject._id;
      const playerId = voteIdToPlayerIdMap.get(voteId);
      const playerName = gameRoom.idToName(playerId);
      const missions = voteObject.missions;

      nameToVotesMap.set(playerName, missions);
    });

    // TODO(neemazad): probably change idToName to return a map, and pass that
    // map in to in_game.js. Then we can move a bunch of this computation into
    // re-useable code there?
    const waitingOnNames = inGameInfo.playersNeedingToAct()
        .map(id => gameRoom.idToName(id));

    const remainingProposerNames = (function() {
      const players = inGameInfo.playersInGame;
      const currProposerIndex = players.findIndex(
          player => player._id == inGameInfo.proposer);

      var names = [];
      for (let i = currProposerIndex;
           i <= currProposerIndex + 5 - inGameInfo.currentProposalNumber;
           ++i) {
        let index = i % players.length;
        names.push(gameRoom.idToName(players[index]._id));
      }
      return names;
    })();

    return {
      inGameReady: instance.subscriptionsReady(),
      title: gameRoom.title,
      ownerId: gameRoom.ownerId,
      roomId: gameRoom._id,
      known: {
        name: player.username,
        role: secretInfo.roleName,
        info: secretInfo.roleInfo,
      },
      playerNames: properlyOrderedPlayerNames,
      nameToVotesMap: nameToVotesMap,
      roleNames: HelperMethods.roleNamesForNPlayerGame(gameRoom.players.length),
      isRoomOwner: Permissions.isRoomOwner(gameRoom),
      isProposer: Meteor.userId() === inGameInfo.proposer,
      currentProposer: gameRoom.idToName(inGameInfo.proposer),
      remainingProposerNames: remainingProposerNames,
      namesOnProposal: currentlyProposed,
      waitingOnNames: waitingOnNames,
      // TODO(neemazad): Look to see whether we should pass in specific
      // inGameInfo fields instead of this object, as we're partially doing
      // that already.
      inGameInfo: inGameInfo,  // almost all info in this object needs to be rendered
    };
  },
});
