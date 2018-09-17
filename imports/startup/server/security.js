import { Meteor } from 'meteor/meteor';
import { Accounts } from 'meteor/accounts-base';

// Deny all client-side updates to user documents for security purposes
Meteor.users.deny({
  update() {
    return true;
  },
});