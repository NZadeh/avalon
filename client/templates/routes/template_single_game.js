import { Template } from 'meteor/templating';
import { FlowRouter } from 'meteor/kadira:flow-router';
import { GameRooms } from '/lib/collections/game_rooms/game_rooms';
import { SecretInfo } from '/lib/collections/game_rooms/secret_info';
import { HelperMethods } from '/lib/collections/game_rooms/methods_helper';

import './template_single_game.html';

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
    const roomDeleted = instance.subscriptionsReady() && !gameRoom;
    const playerKicked = instance.subscriptionsReady() && gameRoom && 
                         !gameRoom.containsUserId(Meteor.userId());
    const playerNoLongerInGame = roomDeleted || playerKicked;
    if (playerNoLongerInGame) {
      // If this occurs, the room was deleted while the user was inside (which caused
      // this helper to run reactively as a result of singleGameRoom changing...)
      // That means it is safe/ideal to route the user back home.
      FlowRouter.go('home');
      if (roomDeleted) { Materialize.toast("Owner deleted the room.", 3000, 'error-toast'); }
      if (playerKicked) { Materialize.toast("Owner kicked you from room.", 3000, 'error-toast'); }
      // Meanwhile, return a not-ready so that in the split second between when the user
      // is actually routed home and while this code is still running (and
      // the template rendering), the template does not try to access fields
      // from the recently-deleted room.
      return { gameRoomReady: false };
    }

    // TODO(neemazad): Consider reworking the template to ask for fields, not just
    // the game room directly?
    if (!gameRoom) gameRoom = {};  // If the gameRoom is not ready, we still need an object...
    gameRoom.gameRoomReady = instance.subscriptionsReady();
    return gameRoom;
  },

  inGameContext() {
    const instance = Template.instance();
    const gameRoom = GameRooms.findOne(
      { _id: instance.getRoomId() },
      { fields: { players: 1, title: 1, ownerId: 1 } }
    );
    if (!gameRoom) {
      return {
        inGameReady: instance.subscriptionsReady(),
        title: 'Game does not appear to exist, or you do not have access to it.',
      };
    }
    var player = gameRoom.players.find(function(player) {
      return player._id === Meteor.userId();
    });
    if (!player) {
      return {
        inGameReady: instance.subscriptionsReady(),
        title: 'You appear not to be in the game... Try going back and rejoining.',
      };
    }

    const secretInfo = SecretInfo.findOne({ playerId: player._id });
    if (!secretInfo) {
      return {
        inGameReady: instance.subscriptionsReady(),
        title: 'You appear not to have gotten your secret info... Ask the host to re-create the game.',
      };
    }

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
      playerNames: gameRoom.players.map(player => player.username),
      roleNames: HelperMethods.roleNamesForNPlayerGame(gameRoom.players.length),
    };
  },
});
