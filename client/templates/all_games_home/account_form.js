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
        };
    },
});

Template.accountForm.events({
    'submit form': function(e, tmpl) {
        e.preventDefault();

        var username = e.target.nameField.value;
        var password = e.target.password.value;

        if (!username) {
            M.toast({html: "Usernames are required.", displayLength: 3000, classes: 'error-toast'});
            return;
        }
        if (!password) {
            M.toast({html: "Passwords are required now, for your own good.", displayLength: 3000, classes: 'error-toast'});
            return;
        }

        // NOTE: For simplicity, we always try to make the account first, and if
        // the account already exists, use "failure" as an opportunity to log in.
        Accounts.createUser({
            username: username,
            password: password,
        }, function(createUserErr) {
            if (createUserErr && createUserErr.error === 403) {
                // A 403 'username already exists' error might mean the account
                // already exists, so the user might just be trying to log in.
                // So let's try to log in! :)
                Meteor.loginWithPassword(username, password, function(loginErr) {
                    if (loginErr && loginErr.error === 403) {
                        M.toast({html: "Username already in use or incorrect password.", displayLength: 3000, classes: 'error-toast'});
                    } else if (loginErr) {
                        M.toast({html: loginErr.reason, displayLength: 3000, classes: 'error-toast'});
                    } else {
                        // Login was successful.
                        M.toast({html: "You're in!", displayLength: 3000, classes: 'success-toast'});
                    }
                });
            } else if (createUserErr) {
                M.toast({html: createUserErr.reason, displayLength: 3000, classes: 'error-toast'});
            } else {
                // Registration was successful (and we're automatically logged in).
                M.toast({html: "You're in!", displayLength: 3000, classes: 'success-toast'});
            }
        });
    }
});
