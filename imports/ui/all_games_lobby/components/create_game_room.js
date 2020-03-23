import './create_game_room.html';

import { FlowRouter } from 'meteor/kadira:flow-router';

import { addGameRoom } from '/imports/collections/game_rooms/methods';

import '/imports/ui/common/create_form.html';

Template.createGameRoom.helpers({
    formArgs: function() {
        return {
            formTitle: "Create game room",
            namePlaceholder: "Game room title",
            passwordPlaceholder: "Room password (optional)",
            submitButtonText: "Create room",
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
                M.toast({html: err, displayLength: 3000, classes: 'error-toast'});
                return;
            }

            if (result.alreadyInRoom) {
                M.toast({html: 'You\'re already in a different game or lobby.', displayLength: 3000, classes: 'error-toast'});
                return;
            }

            FlowRouter.go('singleGame', result);
        });
    }
});
