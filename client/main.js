/* Avalon v... something-rather */

/* We're importing via Javascript here because I have no other idea how
 * to get this from the npm package... and we want these for every page! */
import 'materialize-css';
import 'materialize-css/dist/css/materialize.min.css';
import 'materialize-css/dist/js/materialize.min.js';

/* This pulls in everything the client needs (note: keeping everything in imports
 * allows Meteor to not pull in unneeded files -- only those we explicitly `import`). */
import '/imports/startup/client';  // This looks specifically at the index.js file.

// TODO(neemazad): Move this into the start-up directory imported above?
Meteor.subscribe('userData');
