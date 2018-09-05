import {
  addGameRoom,
} from '/lib/collections/game_rooms';

Template.createGameRoom.onCreated(function() {
    Session.set('gameErrors', {});
});

Template.createGameRoom.helpers({
    errorMessage: function(field) {
        return Session.get('gameErrors')[field];
    },
    errorClass: function(field) {
        return !!Session.get('gameErrors')[field] ? 'has-error' : '';
    }
});

Template.createGameRoom.events({
    'submit form': function(e, tmpl) {
        e.preventDefault();

        addGameRoom.call({
            title: e.target.title.value,
            password: e.target.password.value,
            passwordProtected: !!e.target.password.value
        }, (err, result) => {
            if (err) {
                Materialize.toast(err.reason, 3000, 'error-toast');
                return;
            }

            if (result.alreadyInRoom) {
                Materialize.toast('You\'re already in a different game or lobby.', 3000, 'error-toast');
                return;
            }

            Router.go('gameLobby', result);
        });
    }
});