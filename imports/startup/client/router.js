import { FlowRouter } from 'meteor/kadira:flow-router';
import { BlazeLayout } from 'meteor/kadira:blaze-layout';

import { GameRooms } from '/imports/collections/game_rooms/game_rooms';
import { Permissions } from '/imports/utils/permissions';

// These imports contain the common layout and all of the templates
// the router "routes" to.
import '/imports/ui/application/layout.js';
import '/imports/ui/routes/template_all_games_lobby.js';
import '/imports/ui/routes/template_single_game.js';

FlowRouter.route('/', {
  name: 'home',
  action() {
    BlazeLayout.render('layout', {main: 'Template_allGamesLobby'});
  }
});

FlowRouter.route('/room/:_id', {
  name: 'singleGame',

  triggersEnter: [function(context, redirect) {
    // For some reason, if the user finds their way to this room without
    // actually being in it (e.g. used hard-coded URL), re-route them back home.
    if (!Permissions.activeUserIsInGameRoom(context.params._id)) {
      redirect('/');
    }
  }],

  action() {
    BlazeLayout.render('layout', {main: 'Template_singleGame'});
  }
});

// Redirect all unsupported pages to "home", no questions asked :)
FlowRouter.notFound = {
  action: function() {
    FlowRouter.go('home');
  }
};
