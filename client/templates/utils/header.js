Template.header.events({
    'click .logout': function() {
        // TODO(neemazad): Consider removing a player from everything during logout...?
        Meteor.logout(function() {
        	FlowRouter.go('home');
        });
    }
});
