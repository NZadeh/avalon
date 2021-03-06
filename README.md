Avalon role-dealer and gameplay
====================================================================
A Meteor.js app that handles the Avalon night-phase and, newly,
the in-game mechanics minus chatting. (#coronavirus2019.)

This project (and even the README) started out by cannibalizing
[turbomaze's Petra](https://github.com/turbomaze/petra) (#neverforgetyourroots),
but has since developed way beyond what it started out as, as I
learned more and more about Meteor and how it works -- clearing out
technical debt, etc.

## Usage
When users navigate to the app homepage,
they're faced with a login form and list of game rooms. Once they've
joined a room, they're presented with a waiting page until the game
starts.

### Accounts
There's a simple registration system. Users type in
a unique username and (hopefully unique :) password to log in.

NOTE: Currently, accounts are wiped 6 days after creation.

### Game Rooms
Game rooms are either password protected or they're not. In order to
join a password protected game room, users need to provide the correct
password.

The user who created the game room is designated the room's owner, which
gives them the power to start the game and delete the game room. If they
leave the game room, another user is randomly chosen to be the room's
owner.

NOTE: Game rooms are wiped 12 hours after creation.

## Game Play
Once the room owner starts the game, everyone will receive a role based
on the total number of players, as well as receive any information that
role has. (For example, the player who receives Merlin will also see the
usernames of the Spies [Assassin, Morgana, Oberon, etc.].)

Proposals, missions, and vote history all happen and are tracked in real-time
inside the game room once the game starts.

## Changes in the works (Feature requests)
- Add a way for room owner to pass ownership to a different person in the lobby.
- Give players some way to reveal their information, i.e. "flip their card".
- Give game owner an "end game" functionality that reveals all players' roles.
- "Fun" modes that happen with low probability... (and possibly a way for the owner to disable them)
- Just look at all the TODOs in the code :)

---

## How to get started developing on this project

### Clone the project
I like the GitHub desktop client... :D as that makes it pretty easy to manage everything.

### Install meteor
[https://www.meteor.com/install](https://www.meteor.com/install)

### Run things
- Run `meteor` in the project directory (probably called `.../avalon/`).
  + It will do a bunch of stuff / installations.
- It may complain that you need to run other commands like `meteor npm install --save babel-runtime`. If so, do that, and re-run `meteor`. 

You should be good to go, now...

### Things to know...
The structure of this project has been modeled after the [Meteor guide](https://guide.meteor.com/).
Please read up on that if you have questions about the code as you encounter them; otherwise, just ask me.
The example app that the guide often references is the [Meteor Todos app](https://github.com/meteor/todos).
The example app is the reason why a lot of this project's code is the way it is -- it seems like a
best practice established by the Meteor community. (Code written this way also removes some of the "magic"
"action at a distance" properties that some Meteor projects seem to have, which can be quite confusing
at times.)

In particular, you will notice that the `client` and `server` directories are mostly... "empty"!
(Actually, these are special directories whose code is always loaded by the framework, on
the `client` side and on the `server` side respectively. Even subdirectories that have these
names are treated as special, and the files inside those directories are only linked in to the respective side.)
Apparently, this "emptiness" is by design. The idea is to `import` all of the dependencies we need, so that
we don't link in any dependencies we don't need -- for example, test code that lives side-by-side
with the implementation.

The `imports` directory is a special directory where the code is *never* included by default, and files
in that directory rely on the ECMAScript `import` keyword to make their way into the app. You will notice
that almost all of the app is written inside of the `imports` directory.

#### Materialize!
The UI for this project is handled by the Materialize npm package. The package is included
into this project via `client/main.js`, and gives global access to all of the goodness
explained in the [Materialize documentation](https://materializecss.com/getting-started.html).

---

## Release process
I've been using Galaxy to deploy the Meteor app with minimal configuration.
I separately set up a MongoDB database using https://cloud.mongodb.com/ free
tier quota.

There are decent instructions [online](http://galaxy-guide.meteor.com/deploy-quickstart.html),
but the gist of it is:

Run `meteor` in the project directory so that the app is built and you can tell whether
you need any other dependencies.

Add a tuple in `<project-directory>/settings.json` so that Meteor can connect to MongoDB using the URL
that the Atlas database UI shows, filling in the necessary fields, e.g.:
```
{
  "galaxy.meteor.com": {
    "env": {
      "MONGO_URL": "mongodb+srv://<username>:<password>@<atlas-provided-domain>/<dbname>?retryWrites=true&w=majority"
    }
  }
}
```
(`settings.json` is intentionally `.gitignore`d, since it contains private login information).

Then...

#### (On windows)
From the project directory (e.g. `<your path>/GitHub/avalon`)
```bash
SET DEPLOY_HOSTNAME=galaxy.meteor.com
meteor deploy <choose.any.sub.domain>.meteorapp.com --settings .\settings.json
# ... wait 10-20 minutes ... check up on progress/logs in your Galaxy account.
```
(I've been using `avalon` as the subdomain for meteorapp.com, above.)
