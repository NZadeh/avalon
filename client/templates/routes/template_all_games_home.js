import { Template } from 'meteor/templating';
import { FlowRouter } from 'meteor/kadira:flow-router';
import { GameRooms } from '/lib/collections/game_rooms/game_rooms';

import './template_all_games_home.html';

Template.Template_allGamesHome.onCreated(function allGamesHomeOnCreated() {
  this.autorun(() => {
    this.subscribe('gameRooms');
  });
});

// Template.Lists_show_page.onRendered(function listsShowPageOnRendered() {
//   this.autorun(() => {
//     if (this.subscriptionsReady()) {
//       listRenderHold.release();  // https://atmospherejs.com/meteor/launch-screen
//     }
//   });
// });

Template.Template_allGamesHome.helpers({
  gamesContext() {
    const instance = Template.instance();
    const gameRooms = GameRooms.find({}, {
      sort: {
        passwordProtected: 1,
        createdAt: -1
      }
    }) || [];

    // TODO(neemazad): Figure out how to use gamesReady and loggedIn in `all_games_home`...
    // https://atmospherejs.com/kadira/flow-router#flowrouter-reload ?
    // https://guide.meteor.com/data-loading.html#changing-arguments ?
    return {
      gamesReady: instance.subscriptionsReady(),  // for the `subscribe` call above
      loggedIn: !!Meteor.user(),
      gameRooms
    };
  },
});