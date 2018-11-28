import './header.html';

import '/imports/ui/common/how_to_play.js';

import { FlowRouter } from 'meteor/kadira:flow-router';
import { Meteor } from 'meteor/meteor';

Template.header.onRendered(function() {
  $('.dropdown-trigger').dropdown();
});

Template.header.events({
    'click .logout': function() {
        // It's nice not to boot players from their state if they log out
        // and log back in. We will have server-wide clean-up to do that for
        // us based on timestamp, so we don't need to do anything special here.
        Meteor.logout(function() {
        	FlowRouter.go('home');
        });
    }
});
