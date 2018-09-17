import { Meteor } from 'meteor/meteor';

var graceTime = 10*1000; //how long people can leave rooms for
Meteor.startup(function() {
    Meteor.setInterval(function() {
        // TODO(neemazad): We want to use this to auto-clean-up the rooms
        // if they haven't been used in a while...
        // TODO(neemazad): Also auto-clean up accounts... there's almost
        // no downside to deleting the accounts each week... as logging
        // in and creating an account are literally the same flow.
        // People also make somewhat silly names, so this enables them
        // to do that.
    }, graceTime/3);
});
