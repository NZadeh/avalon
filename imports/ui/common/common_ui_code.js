export const CommonUiCode = {
  leaveGameModalArgs: function(event_handler_class) {
    return {
      // Assumption is a screen would only ever show one leave-game modal.
      // A player cannot be in multiple rooms at once.
      uniqueId: "leave-game-modal",
      buttonName: "Leave Game",
      modalHeader: "Leave Game?",
      modalText: "You can return after leaving, but the game " +
                 "cannot progress while you are gone.",
      modalResponseButtons: [
        {text: "Leave", addlButtonClasses: event_handler_class},
        {text: "Never mind"},
      ],
    };
  },
};
