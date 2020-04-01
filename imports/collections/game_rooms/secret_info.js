import { Mongo } from 'meteor/mongo';
import SimpleSchema from 'simpl-schema';

import { HelperConstants } from '/imports/collections/game_rooms/constants';

export const SecretInfo = new Mongo.Collection('SecretInfo');
export const secretInfoUniqueId = function(playerId, roomId) {
  return `${playerId}_${roomId}`;
};

const uniqueIdValidator = new SimpleSchema({
  id: {
    type: String,
    regEx: SimpleSchema.RegEx.Id,
  },
});

const secretInfoUniqueIdValidation = function() {
  const [playerId, roomId] = this.value.split("_", 2);

  return uniqueIdValidator.validate([
    { id: playerId },
    { id: roomId },
  ]);
};

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
  uniqueId: {
    type: String,
    custom: secretInfoUniqueIdValidation,
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
