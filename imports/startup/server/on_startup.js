import { Meteor } from 'meteor/meteor';
import { GameRooms } from '/imports/collections/game_rooms/game_rooms';

const findInactiveIdsFromCursor = function(mongoCursor, inactiveMs) {
  var inactiveIds = [];
  const now = new Date();

  mongoCursor.forEach((object) => {
    if (now.getTime() - object.createdAt.getTime() > inactiveMs) {
      inactiveIds.push(object._id);
    }
  });

  return inactiveIds;
};

const deleteInactiveRooms = function(inactiveMs) {
  const allRooms = GameRooms.find({});
  const roomIdsToRemove = findInactiveIdsFromCursor(allRooms, inactiveMs);
  GameRooms.remove({ _id: { $in: roomIdsToRemove } });
};

const deleteInactiveAccounts = function(inactiveMs) {
  const users = Meteor.users.find({});
  const userIdsToRemove = findInactiveIdsFromCursor(users, inactiveMs);
  Meteor.users.remove({ _id: { $in: userIdsToRemove } });
}

Meteor.startup(function() {
  const cleanDelayInMs = 60 * 1000;  // Check once a minute.
  const kInactiveRoomThresholdMs = 4 * 60 * 60 * 1000;  // 4 hours.
  const kInactiveAccountThresholdMs = 6 * 24 * 60 * 60 * 1000;  // ~6 days.

  Meteor.setInterval(function() {
    deleteInactiveRooms(/*if inactive for*/kInactiveRoomThresholdMs);

    // There's almost no downside to deleting the accounts each week... as
    // logging in and creating an account are literally the same flow.
    // People also make somewhat silly names, so this enables them
    // to do that without major repercussions.
    // TODO(neemazad): Track a field like "user has done something" and use
    // that instead of createdAt to determine when to delete an account.
    deleteInactiveAccounts(/*if inactive for*/kInactiveAccountThresholdMs);
  }, cleanDelayInMs);
});
