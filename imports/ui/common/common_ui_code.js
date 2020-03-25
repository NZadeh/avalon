export const CommonUiCode = {
  leaveGameModalArgs: function(event_handler_class) {
    return {
      // Assumption is a screen would only ever show one leave-game modal.
      // A player cannot be in multiple rooms at once.
      uniqueId: "leave-game-modal",
      buttonName: "Leave Game",
      modalHeader: "Leave Game?",
      modalText: "Leaving while the game is in progress will " +
                 "probably break the rest of the game. " +
                 "You will not be able to rejoin the same game.",
      modalResponseButtons: [
        {text: "Leave", addlButtonClasses: event_handler_class},
        {text: "Never mind"},
      ],
    };
  },
};
