import { Template } from 'meteor/templating';
import { FlowRouter } from 'meteor/kadira:flow-router';
import { GameRooms } from '/lib/collections/game_rooms/game_rooms';

import './template_all_games_home.html';

Template.Template_allGamesHome.onCreated(function allGamesHomeOnCreated() {
  this.autorun(() => {
    this.subscribe('gameRooms');
  });
});

Template.Template_allGamesHome.helpers({
  gamesContext() {
    const instance = Template.instance();
    const gameRooms = GameRooms.find({}, {
      sort: {
        passwordProtected: 1,
        createdAt: -1
      }
    });

    return {
      gamesReady: instance.subscriptionsReady(),  // for the `subscribe` call above
      loggedIn: !!Meteor.user(),
      playerId: Meteor.userId(),
      gameRooms
    };
  },
});