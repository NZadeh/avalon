if (Meteor.isServer) {
    var graceTime = 10*1000; //how long people can leave rooms for
    Meteor.startup(function() {
        Meteor.setInterval(function() {
            // TODO(neemazad): We want to use this to auto-clean-up the rooms
            // if they haven't been used in a while...
        }, graceTime/3);
    });
}