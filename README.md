Avalon role-dealer
====================================================================
A Meteor.js app that handles the Avalon night-phase.

A lot of this README, and indeed the project (especially the lobby
system), is adapted from [turbomaze's Petra](https://github.com/turbomaze/petra).
Of course, there have been additional changes on top of that project...
but never forget your roots :)

## Usage
When users navigate to the app homepage,
they're faced with a login form and list of game rooms. Once they've
joined a room, they're presented with a waiting page until the game
starts. It's worth calling out again that this lobby functionality
was adapted from [turbomaze's Petra](https://github.com/turbomaze/petra),
where there was expressed-interest in making it a generic library... :)

### Accounts
No one likes registering for new websites, so "Avalon role-dealer" has a very
loose registration system. Users can just type a username to log in; passwords
are optional.

### Game Rooms
Game rooms are either password protected or they're not. In order to
join a password protected game room -- either via the main page or via
a direct link -- users need to provide the correct password.

The user who created the game room is designated the room's owner, which
gives them the power to start the game and delete the game room. If they
leave the game room, another user is randomly chosen to be the room's
owner.

## Game Play
Once the room owner starts the game, everyone will receive a role based
on the total number of players, as well as receive any information that
role has. (For example, the player who receives Merlin will also see the
usernames of the Spies [Assassin, Morgana, Oberon, etc.].)

## Changes in the works (Feature requests)
- Add a way for room owner to pass ownership to a different person in the lobby.
- Give players some way to reveal their information, i.e. "flip their card".
- Give game owner an "end game" functionality that reveals all players' roles.
- Log out players automatically after X hours.
- Unify all styling/classes to Materialize
- Remove unnecessary dependencies (how?)
- Move some computation server side...? (Limit the scope of client<-->database requests)

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

---

## Release process
I've been using Galaxy to deploy the Meteor app with minimal configuration.
I separately set up a MongoDB database using mLab's free tier quota.

There are decent instructions [online](http://galaxy-guide.meteor.com/deploy-quickstart.html),
but the gist of it is:

Run `meteor` in the project directory so that the app is built and you can tell whether
you need any other dependencies.

Add a tuple in `settings.json` so that Meteor can connect to MongoDB using the URL
that mLab shows, filling in the necessary fields, e.g.:
```
  "galaxy.meteor.com": {
    "env": {
      "MONGO_URL": "mongodb://<username>:<password>@<mlab-provided-domain>:<port>/<database-name>"
    }
  }
```
(`settings.json` is intentionally `.gitignore`d).

Then...

#### (On windows)
From the project directory (e.g. `<your path>/GitHub/avalon`)
```bash
SET DEPLOY_HOSTNAME=galaxy.meteor.com
meteor deploy <choose.any.sub.domain>.meteorapp.com --settings .\settings.json
# ... wait 10-20 minutes ... check up on progress/logs in your Galaxy account.
```