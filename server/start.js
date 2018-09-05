if (Meteor.isServer) {
    var graceTime = 10*1000; //how long people can leave rooms for
    Meteor.startup(function() {
        Meteor.setInterval(function() {
            // TODO(neemazad): This relied on leaveRoom to work. Now we
            // want to use this to auto-clean-up the rooms if they haven't been
            // used in a while...

            // Old code below:

            // var rooms = GameRooms.find().fetch();
            // rooms.map(function(room) {
            //     room.players.map(function(player) {
            //         return player._id;
            //     }).map(function(userId) {
            //         var user = Meteor.users.findOne(userId);
            //         var currRoom = user.profile.currentGameRoom;
            //         var timeSinceLeave = +new Date() - user.profile.leftAt;
            //         if (currRoom !== room._id && timeSinceLeave > graceTime) {
            //             //their current room doesn't match this one, so
            //             //remove them from this one
            //             removeJoinAuth(
            //                 userId,
            //                 user.username,
            //                 room._id
            //             );
            //         }
            //     });
            // });
        }, graceTime/3);
    });
}