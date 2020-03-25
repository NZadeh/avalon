import { Mongo } from 'meteor/mongo';
import SimpleSchema from 'simpl-schema';

import { HelperConstants } from '/imports/collections/game_rooms/constants';

export const SecretInfo = new Mongo.Collection('SecretInfo');

// Deny all client-side updates since we will be using methods to manage this collection
SecretInfo.deny({
  insert() { return true; },
  update() { return true; },
  remove() { return true; },
});

SecretInfo.schema = new SimpleSchema({
  _id: {
    type: String,
    regEx: SimpleSchema.RegEx.Id,
  },
  playerId: {  // This ID should just be the user ID.
    type: String,
    regEx: SimpleSchema.RegEx.Id,
  },
  roleName: String,
  roleInfo: String,
  alignment: {
    type: String,
    allowedValues: [
      HelperConstants.kResistance,
      HelperConstants.kSpy,
    ],
  },
});

SecretInfo.attachSchema(SecretInfo.schema);
