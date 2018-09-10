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
        var password = 'v'+e.target.password.value;

        if (!username) {
            Materialize.toast("Usernames are required.", 3000, 'error-toast');
            return;
        }

        // NOTE: For simplicity, we always try to make the account first, and if
        // the account already exists, use "failure" as an opportunity to log in.
        // TODO(neemazad): Once accounts become longer term, consider reworking
        // this strategy... :P  
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
                        Materialize.toast("Username already in use, or incorrect password.", 3000, 'error-toast');
                    } else if (loginErr) {
                        Materialize.toast(loginErr.reason, 3000, 'error-toast');
                    } else {
                        // Login was successful.
                        Materialize.toast("You're in!", 3000, 'success-toast');
                    }
                });
            } else if (createUserErr) {
                Materialize.toast(createUserErr.reason, 3000, 'error-toast');
            } else {
                // Registration was successful (and we're automatically logged in).
                Materialize.toast("You're in!", 3000, 'success-toast');
            }
        });
    }
});
