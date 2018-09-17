import { Mongo } from 'meteor/mongo';
import SimpleSchema from 'simpl-schema';

import { GameRoomHooks } from '/imports/collections/game_rooms/hooks.js';

class GameRoomCollection extends Mongo.Collection {
  insert(room, callback) {
    const newRoomId = super.insert(room, callback);
    GameRoomHooks.afterInsertRoom(room, newRoomId); 
    return newRoomId;
  }

  update(selector, modifier) {
    const result = super.update(selector, modifier);
    GameRoomHooks.afterUpdateRoom(selector, modifier);
    return result;
  }

  remove(selector, callback) {
    const rooms = this.find(selector).fetch();
    const result = super.remove(selector, callback);
    GameRoomHooks.afterRemoveRooms(rooms);
    return result;
  }
}

export const GameRooms = new GameRoomCollection('GameRooms');

// Deny all client-side updates since we will be using methods to manage this collection
GameRooms.deny({
  insert() { return true; },
  update() { return true; },
  remove() { return true; },
});

// TODO(neemazad): Add a schema for Meteor.users somewhere... (check docs online?)
// In particular, this is useful since we are extending the fields to include
// `currentGameRoomId`, so a schema would serve as some sort of documentation of
// what is available as well.
GameRooms.schema = new SimpleSchema({
  _id: {
    type: String,
    regEx: SimpleSchema.RegEx.Id,
  },
  ownerId: {
    type: String,
    regEx: SimpleSchema.RegEx.Id,
  },
  author: {
    type: String,
    max: 100,
  },
  title: {
    type: String,
    max: 100,
  },
  password: {
    type: String,
    optional: true,
    max: 100,
  },
  passwordProtected: {
    type: Boolean,
    defaultValue: false,
  },
  createdAt: {
    type: Date,
  },
  open: {
    type: Boolean,
    defaultValue: true,
  },

  players: {
    type: Array,
    minCount: 1,
    maxCount: 10,
  },
  'players.$': Object,
  'players.$._id': String,
  'players.$.username': String,
});

GameRooms.attachSchema(GameRooms.schema);

// See https://guide.meteor.com/collections.html#collection-helpers for info.
GameRooms.helpers({
  containsUserId(userId) {
    return this.players.reduce(
      (alreadyContains, player) => alreadyContains || player._id == userId,
      /*initialValue=*/false
    );
  },
});




// // This factory is for creating randomized test data. Do we need it?
// // See https://guide.meteor.com/testing.html#generating-test-data.
// Factory.define('random_game_room', GameRooms, {
//   // TODO(neemazad): Update this
//   // listId: () => Factory.get('list'),
//   // text: () => faker.lorem.sentence(),
//   // createdAt: () => new Date(),
// });
