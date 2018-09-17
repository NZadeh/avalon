import { Meteor } from 'meteor/meteor';

// This contains data like the user's current game room, that should be
// available to the client at all times (irrespective of template being
// rendered).
Meteor.subscribe('userData');
