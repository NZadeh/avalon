Template.accountForm.onCreated(function() {
    Session.set('accountErrors', {});
});

Template.accountForm.helpers({
    // Establishes the data context for the child "createForm" template.
    formArgs: function() {
        return {
            formTitle: "Use this form to claim a username.",
            namePlaceholder: "Your (preferred) name",
            passwordPlaceholder: "Password (optional)",
            submitButtonText: "Login with name",

            // This string is passed in to Session.get('accountErrors').
            // That specifically populates a "username" and "password" error field.
            // "password" is already specified directly in the child template.
            errorClassNameField: "username",

            errorMessage: function(field) {
                return Session.get('accountErrors')[field];
            },
            errorClass: function(field) {
                return !!Session.get('accountErrors')[field] ? 'has-error' : '';
            }
        };
    },
});

Template.accountForm.events({
    'submit form': function(e, tmpl) {
        e.preventDefault();

        var username = e.target.nameField.value;
        var password = 'v'+e.target.password.value;

        if (!username) {
            return Session.set('accountErrors', {
                username: 'Usernames are required.'
            });
        }

        Accounts.createUser({
            username: username,
            password: password
        }, function(err1) {
            //'username already exists' error means
            //they might be trying to log in
            if (err1 && err1.error === 403) {
                Meteor.loginWithPassword(username, password,
                    function(err2) {
                        if (err2 && err2.error === 403) {
                            return Session.set(
                                'accountErrors', {
                                    username: 'Username is in use',
                                    password: '...or incorrect password.'
                                }
                            );
                        } else if (err2) {
                            throw new Meteor.Error(
                                'error', err2.reason
                            );
                        } else {
                            //successful login
                        }
                    }
                );
            } else if (err1 && err1.error === 400) {
                return Session.set('accountErrors', {
                    password: err1.message
                });
            } else if (err1) {
                return Session.set('accountErrors', {
                    username: err1.message
                });
            } else {
                //successful registration
            }
        });
    }
});
