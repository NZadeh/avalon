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

    // TODO(neemazad): Make these error messages more accurate. (Track state.)

    // Reasons we may need to route the user away:
    // (note, this runs reactively if gameRoom changes)
    // - The room was deleted while the user was inside
    // - The user was kicked from the room...
    // - The user is not in this room but they know the URL/room id for some reason.
    const playerLeftOrRoomDeleted = instance.subscriptionsReady() && !gameRoom;
    const playerKicked = instance.subscriptionsReady() && gameRoom && 
                         !gameRoom.containsUserId(Meteor.userId());
    const playerNoLongerInGame = playerLeftOrRoomDeleted || playerKicked;
    if (playerNoLongerInGame) {
      // For the reasons above, we should route the user back home.
      FlowRouter.go('home');
      if (playerLeftOrRoomDeleted) { M.toast({html: "You left (or owner deleted the room).", displayLength: 3000, classes: 'error-toast'}); }
      if (playerKicked) { M.toast({html: "Owner kicked you from room.", displayLength: 3000, classes: 'error-toast'}); }
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
      { fields: { players: 1, title: 1, ownerId: 1 } }
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
      isRoomOwner: Permissions.isRoomOwner(gameRoom),
    };
  },
});
