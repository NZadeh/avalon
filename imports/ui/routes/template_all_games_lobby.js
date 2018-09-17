import './template_all_games_lobby.html';

import { FlowRouter } from 'meteor/kadira:flow-router';
import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';

import { GameRooms } from '/imports/collections/game_rooms/game_rooms';

import '/imports/ui/all_games_lobby/all_games_lobby.js';

Template.Template_allGamesLobby.onCreated(function allGamesLobbyOnCreated() {
  this.autorun(() => {
    this.subscribe('gameRooms');
  });
});

Template.Template_allGamesLobby.helpers({
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
