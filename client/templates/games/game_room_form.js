Template.gameRoomForm.onCreated(function() {
    Session.set('gameErrors', {});
});

Template.gameRoomForm.helpers({
    errorMessage: function(field) {
        return Session.get('gameErrors')[field];
    },
    errorClass: function(field) {
        return !!Session.get('gameErrors')[field] ? 'has-error' : '';
    }
});

Template.gameRoomForm.events({
    'submit form': function(e, tmpl) {
        e.preventDefault();

        var gameRoom = {
            title: e.target.title.value,
            password: e.target.password.value
        };
        gameRoom.passwordProtected = !!gameRoom.password;

        Meteor.call('addGameRoom', gameRoom, function(err, result) {
            if (err) return console.log(err);

            if (result.alreadyInRoom) {
                Materialize.toast('You\'re already in a game room.', 3000); return;
            }

            Router.go('gameRoomPage', result);
        });
    }
});