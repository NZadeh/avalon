import { Mongo } from 'meteor/mongo';
import SimpleSchema from 'simpl-schema';

import { HelperConstants } from '/imports/collections/game_rooms/constants';

export const SecretInfo = new Mongo.Collection('SecretInfo');
export const secretInfoUniqueId = function(playerId, roomId) {
  return `${playerId}_${roomId}`;
};
export const secretInfoUniqueIdToPlayerId = function(uniqueId) {
  return uniqueId.split("_", 2)[0];
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

const nameContainsAllowedRoleNames = function() {
  const barSeparatedNames =
    HelperConstants.kAllowedRoleNames.reduce(
      (accumulator, curr) => `${accumulator}|${curr}`
    );
  return new RegExp(`(${barSeparatedNames}).*`);
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
  // This "role name" also includes team information.
  roleName: {
    type: String,
    regEx: nameContainsAllowedRoleNames,
  },
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
