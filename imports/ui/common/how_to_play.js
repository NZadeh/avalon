import './how_to_play.html';

import { HelperConstants } from '/imports/collections/game_rooms/constants';

const kHowToPlayModalId = "how-to-play-modal";
const kHowToPlayModalName = "Role Info";

Template.howToPlayLinkText.helpers({
  linkName() { return kHowToPlayModalName; },
  uniqueId() { return kHowToPlayModalId; },
});

Template.howToPlayModal.helpers({
  modalName() { return kHowToPlayModalName; },
  uniqueId() { return kHowToPlayModalId; },
});

Template.howToPlayModal.onRendered(function() {
  // Makes the height of the carousel tab large enough to contain the content.
  const resizeTabToActiveItemHeight = function() {
    $('.tabs-content').css('height', $('.carousel-item.active').height() + 'px');
  }  

  // TODO(neemazad): Sometimes, after clicking through to Role Info multiple times,
  // the content does not appear until clicking around on the different tabs. Why?
  $(`#${kHowToPlayModalId}`).modal({
    // Voodoo magic found online to make the tabs work inside of a modal...
    onOpenEnd: function(el) {
      $(el).find('.tabs').tabs({ swipeable: true, onShow: resizeTabToActiveItemHeight });
    }
  });

  $('.tabs').tabs({
      swipeable: true,
      onShow: resizeTabToActiveItemHeight
  });

  $( window ).resize(function() {
    resizeTabToActiveItemHeight();
  });
});

// This is all of the text in the modal... :)
Template.howToPlayTabs.helpers({
  idify(tabname) {
    return "how-to-play-" + tabname.replace(/\s+/g, '').toLowerCase();
  },

  tabs() {
    return [
      {
        name: "Basics",
        color: "green lighten-5",
        content: {
          introduction: "Some refresher basics for Avalon.",
          bullets: [
            "Each player is either a Loyal Servant (Resistance) or a Minion of Mordred (Spy)."
          , "Players take turns proposing 'Missions', and the table votes on each proposal. "
            + "If a majority approves the mission, the players in the proposal secretly play "
            + "a Success [resistance or spies] or a Fail [spies only]. "
            + "If no majority approves, the next player proposes a (new) Mission."
          , "If at least one fail is played (unless the 4th mission requires 2 fails), the mission "
            + "fails (point for spies). Otherwise it succeeds (point for resistance)."
          , "There are 5 missions total. First team to 3 points wins*!"
          , "*If resistance score 3 points, the spies can still win by correctly guessing "
            + "which player is Merlin."
          ],
        },
      },

      {
        name: HelperConstants.kMerlin,
        color: "blue lighten-5",
        content: {
          introduction: "Merlin is a Loyal Servant (on the Resistance).",
          bullets: [
            "Merlin knows the usernames of all spies (in no particular order)."
          , "Merlin is one of two roles known to Percival (the other being Morgana)."
          , "At the end of the game, if the Assassin (spy) can identify Merlin correctly, the spies win."
          , "TIP: If you are Merlin, there are various possible Merlin playstyles. Just "
            + "remember, the spies are watching out for signs that distinguish you..."
          , "TIP: If a game is not going well, sometimes it can be better to stay calm "
            + "and hope that team-members (like Percival) have enough information or gut "
            + "feeling to figure out who the good team is, rather than telling the table "
            + "information 'you shouldn't know' and revealing yourself to the spies. "
            + "Of course, feel free to remain as enthusiastic and involved as the other "
            + "Resistance members would be in that position (so as not to give yourself "
            + "away in the opposite direction :)."
          ],
        },
      },

      {
        name: HelperConstants.kPercival,
        color: "blue lighten-5",
        content: {
          introduction: "Percival is a Loyal Servant (on the Resistance).",
          bullets: [
            "Percival knows the usernames of Merlin and Morgana (in no particular order)."
          , "TIP: Percival should pay close attention to Merlin and Morgana's words, proposals, "
            + "and voting -- figure out patterns of support-for-other-players, or inconsistencies."
          , "TIP: Percival is often a good Merlin 'decoy' to help confuse the Spies."
          , "TIP: Different Merlins have different playstyles. A single mistake (e.g. proposal "
            + "with spies on it) by one of your two players should not necessarily "
            + "permanently rule out that person as Merlin."
          ],
        },
      },

      {
        name: HelperConstants.kMorgana,
        color: "red lighten-5",
        content: {
          introduction: "Morgana is a Minion of Mordred (a Spy).",
          bullets: [
            "Morgana is a special spy only in that she is one of two roles known to "
            + "Percival (the other being Merlin)."
          , "(NOTE: If Oberon [Spy] is in the game, Morgana does not see Oberon's username.)"
          , "TIP: Morgana may try to act like Merlin (especially earlier in the game) "
            + "specifically to confuse Percival."
          , "TIP: This can mean failing less aggressively or trying to maintain a consistent "
            + "set of 'good players' that you advocate for throughout the game."
          ],
        },
      },

      {
        name: HelperConstants.kAssassin,
        color: "red lighten-5",
        content: {
          introduction: "Assassin is a Minion of Mordred (a Spy).",
          bullets: [
            "Assassin is a special spy only in that she has the final call on who "
            + "to assassinate (i.e. guess who Merlin is) if the Resistance win 3 missions."
          , "(NOTE: If Oberon [Spy] is in the game, Assassin does not see Oberon's username.)"
          , "TIP: Assassin, since she is unknown to Percival, may help the spies "
            + "differentiate between Percival (who only knows Morgana) and Merlin."
          ],
        },
      },

      {
        name: HelperConstants.kLoyal,
        color: "blue lighten-5",
        content: {
          introduction: "Loyal Servant is... a Loyal Servant (on the Resistance).",
          bullets: [
            "TIP: While Merlin ultimately can guide the game, often times it is the "
          + "responsibility of the Loyal Servants to remain viable 'Merlin candidates.'"
          , "TIP: This often means never fully distrusting another player, as they might "
            + "be on your team!"
          , "TIP: This often also means erring on the side of rejecting mission proposals "
            + "(unless you have a hunch :)."
          ],
        },
      },

      {
        name: HelperConstants.kOberon,
        color: "red lighten-5",
        content: {
          introduction: "Oberon is a Minion of Mordred (a Spy).",
          bullets: [
            "Oberon is a spy that neither knows who the other spies are nor is known by the other spies."
          , "TIP: Oberon is often the more aggressive 'failer', and generally it is the "
            + "responsibility of other spies to play cautiously when Oberon is in the game."
          ],
        },
      },

      {
        name: HelperConstants.kMinion,
        color: "red lighten-5",
        content: {
          introduction: "Minion of Mordred is... a Minion of Mordred (a Spy).",
          bullets: [
            "Minion of Mordred is similar to the Assassin, without the ability to force "
            + "an assassination target."
          ],
        },
      },

      {
        name: "Mission Counts",
        color: "green lighten-5",
        content: {
          introduction: "The number of players in each proposal changes based on "
                      + "the mission number and total player count.",
          bullets: [
            "5 players: 2 3 2 3 3"
          , "6 players: 2 3 4 3 4"
          , "7 players: 2 3 3 4* 4"
          , "8 players: 3 4 4 5* 5"
          , "9 players: 3 4 4 5* 5"
          , "10 players: 3 4 4 5* 5"
          ],
        },
      },
    ];
  },
});
