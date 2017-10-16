Avalon role-dealer
====================================================================
A Meteor.js app that handles the Avalon night-phase.

A lot of this README, and indeed the project (especially the lobby
system), is copied from [turbomaze's Petra](https://github.com/turbomaze/petra).

## Usage
When users navigate to the app homepage,
they're faced with a login form and list of game rooms. Once they've
joined a room, they're presented with a waiting page until the game
starts. It's worth calling out again that this lobby functionality
was taken with minimal change from 
[turbomaze's Petra](https://github.com/turbomaze/petra),
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