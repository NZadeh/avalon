import {
  addGameRoom,
} from '/lib/collections/game_rooms/methods';

Template.createGameRoom.helpers({
    formArgs: function() {
        return {
            formTitle: "Create game room",
            namePlaceholder: "Game room title",
            passwordPlaceholder: "Room password (optional)",
            submitButtonText: "Create room",

            // These fields are currently unused, as I'm not sure we need to
            // propagate errors in html, given that we have the Materialize.toasts.
            errorClassNameField: "",
            errorMessage: function(field) { return ''; },
            errorClass: function(field) { return ''; },
        };
    },
});

Template.createGameRoom.events({
    'submit form': function(e, tmpl) {
        e.preventDefault();

        addGameRoom.call({
            title: e.target.nameField.value,
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
