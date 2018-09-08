import { Template } from 'meteor/templating';
import { FlowRouter } from 'meteor/kadira:flow-router';
import { GameRooms } from '/lib/collections/game_rooms/game_rooms';
import { HelperConstants } from '/lib/collections/game_rooms/constants';

import './template_single_game.html';

Template.Template_singleGame.onCreated(function singleGameOnCreated() {
  this.getRoomId = () => FlowRouter.getParam('_id');

  this.autorun(() => {
    this.subscribe('singleGameRoom', this.getRoomId());
    this.subscribe('playerSpecificInGameInfo', this.getRoomId());
  });
});

// Template.Lists_show_page.onRendered(function listsShowPageOnRendered() {
//   this.autorun(() => {
//     if (this.subscriptionsReady()) {
//       listRenderHold.release();  // https://atmospherejs.com/meteor/launch-screen
//     }
//   });
// });

Template.Template_singleGame.helpers({
  lobbyContext() {
    const instance = Template.instance();
    const gameRoom = GameRooms.findOne(instance.getRoomId());

    if (!gameRoom) {
      // Probably the room was deleted while the user was inside, when this is
      // run reactively as a result of a singleGameRoom changing...
      // That means it is safe/ideal to route the user back home.
      FlowRouter.go('home');
    }

    return gameRoom;

    // TODO(neemazad): Probably will need to do something to wait for the subscription...
    // return {
    //   gamesReady: instance.subscriptionsReady(),  // for the `subscribe` call above
    //   loggedIn: !!Meteor.user(),
    //   gameRooms
    // };
  },

  gameStarted() {
    const instance = Template.instance();
    // We only need the "open" field for this query -- hopefully this limits reactivity?
    const gameRoom = GameRooms.findOne({_id: instance.getRoomId()}, { fields: { open: 1 } });
    return gameRoom && !gameRoom.open  // If there is no gameRoom, this should return false.
  },

  inGameContext() {
    const instance = Template.instance();
    const gameRoom = GameRooms.findOne(
      { _id: instance.getRoomId() },
      { fields: { players: 1, title: 1, ownerId: 1 } });  // TODO(neemazad): Update this query as well?
    if (!gameRoom) return {title: 'Game does not appear to exist, or you do not have access to it.'};

    var player = gameRoom.players.find(function(player) {
      return player._id === Meteor.userId();
    });
    if (!player) return {title: 'You appear not to be in the game... Try going back and rejoining.'}

    return {
      title: gameRoom.title,
      ownerId: gameRoom.ownerId,
      roomId: gameRoom._id,
      known: {
        name: player.username,
        role: player[HelperConstants.kRoleField][HelperConstants.kRoleNameField],
        info: player[HelperConstants.kRoleField][HelperConstants.kRoleKnownInfo],
      },
      players: gameRoom.players,  // TODO(neemazad): Reformat the template and this data to not include everything.
    };
  },
});
