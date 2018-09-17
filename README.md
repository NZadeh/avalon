Avalon role-dealer
====================================================================
A Meteor.js app that handles the Avalon night-phase.

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
"Avalon role-dealer" has a simple registration system. Users type in
a unique username and (hopefully unique :) password to log in.

NOTE: Currently, accounts are wiped after 6 days.

### Game Rooms
Game rooms are either password protected or they're not. In order to
join a password protected game room -- either via the main page or via
a direct link -- users need to provide the correct password.

The user who created the game room is designated the room's owner, which
gives them the power to start the game and delete the game room. If they
leave the game room, another user is randomly chosen to be the room's
owner.

NOTE: Game rooms are wiped after 4 hours.

## Game Play
Once the room owner starts the game, everyone will receive a role based
on the total number of players, as well as receive any information that
role has. (For example, the player who receives Merlin will also see the
usernames of the Spies [Assassin, Morgana, Oberon, etc.].)

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
{
  "galaxy.meteor.com": {
    "env": {
      "MONGO_URL": "mongodb://<username>:<password>@<mlab-provided-domain>:<port>/<database-name>"
    }
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
(I've been using `avalon` as the subdomain for meteorapp.com, above.)
