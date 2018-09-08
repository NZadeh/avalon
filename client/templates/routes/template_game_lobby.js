import { Template } from 'meteor/templating';
import { FlowRouter } from 'meteor/kadira:flow-router';
import { GameRooms } from '/lib/collections/game_rooms/game_rooms';

import './template_game_lobby.html';

Template.Template_gameLobby.onCreated(function gameLobbyOnCreated() {
  this.getRoomId = () => FlowRouter.getParam('_id');

  this.autorun(() => {
    this.subscribe('singleGameRoom', this.getRoomId());
  });
});

// Template.Lists_show_page.onRendered(function listsShowPageOnRendered() {
//   this.autorun(() => {
//     if (this.subscriptionsReady()) {
//       listRenderHold.release();  // https://atmospherejs.com/meteor/launch-screen
//     }
//   });
// });

Template.Template_gameLobby.helpers({
  gameContext() {
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
});
