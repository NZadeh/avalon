import { Mongo } from 'meteor/mongo';
// import { Factory } from 'meteor/dburles:factory';
import SimpleSchema from 'simpl-schema';
// import faker from 'faker';
// import incompleteCountDenormalizer from './incompleteCountDenormalizer.js';

class GameRoomCollection extends Mongo.Collection {
  // insert(doc, callback) {
  //   const ourDoc = doc;
  //   ourDoc.createdAt = ourDoc.createdAt || new Date();
  //   const result = super.insert(ourDoc, callback);
  //   incompleteCountDenormalizer.afterInsertTodo(ourDoc);
  //   return result;
  // }
  // update(selector, modifier) {
  //   const result = super.update(selector, modifier);
  //   incompleteCountDenormalizer.afterUpdateTodo(selector, modifier);
  //   return result;
  // }
  // remove(selector) {
  //   const todos = this.find(selector).fetch();
  //   const result = super.remove(selector);
  //   incompleteCountDenormalizer.afterRemoveTodos(todos);
  //   return result;
  // }
}

export const GameRooms = new GameRoomCollection('GameRooms');

// Deny all client-side updates since we will be using methods to manage this collection
// TODO(neemazad): Is this doing anything?
GameRooms.deny({
  insert() { return true; },
  update() { return true; },
  remove() { return true; },
});

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
  // TODO(neemazad): Currently, the info a player knows is also added into
  // 'players.$.role' with subfields 'roleName' and 'knownInfo'.
  // We will be moving this out into its own collection eventually...
  'players.$.role': {
    type: Object,
    optional: true,  // Currently, players get assigned this field after the game starts.
  },
  'players.$.role.roleName': String,
  'players.$.role.knownInfo': String,
});

GameRooms.attachSchema(GameRooms.schema);

// This represents the keys from Lists objects that should be published
// to the client. If we add secret properties to List objects, don't list
// them here to keep them private to the server.
// GameRooms.publicFields = {
//   listId: 1,
//   text: 1,
//   createdAt: 1,
//   checked: 1,
// };

// // This factory is for creating randomized test data. Do we need it?
// // See https://guide.meteor.com/testing.html#generating-test-data.
// Factory.define('random_game_room', GameRooms, {
//   // TODO(neemazad): Update this
//   // listId: () => Factory.get('list'),
//   // text: () => faker.lorem.sentence(),
//   // createdAt: () => new Date(),
// });

// // If we need helpers, implement: https://guide.meteor.com/collections.html#collection-helpers
// GameRooms.helpers({
//   list() {
//     return Lists.findOne(this.listId);
//   },
//   editableBy(userId) {
//     return this.list().editableBy(userId);
//   },
// });
