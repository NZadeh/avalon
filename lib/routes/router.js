import { GameRooms } from '/lib/collections/game_rooms/game_rooms';
import { Permissions } from '/lib/utils/permissions';

FlowRouter.route('/', {
  name: 'home',
  action() {
    BlazeLayout.render('layout', {main: 'Template_allGamesHome'});
  }
});

FlowRouter.route('/room/:_id', {
  name: 'gameLobby',

  triggersEnter: [function(context, redirect) {
    // For some reason, if the user finds their way to this room without
    // actually being in it (e.g. used hard-coded URL), re-route them back home.
    // TODO(neemazad): There appears to be an issue here where the user is not
    // subscribed to GameRooms and are trying to access this page, and then
    // this function fails...?
    if (!Permissions.activeUserIsInGameRoom(context.params._id)) {
      redirect('/');
    }
  }],

  action() {
    BlazeLayout.render('layout', {main: 'Template_gameLobby'});
  }
});
