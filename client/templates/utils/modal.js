Template.modal.onRendered(function() {
  $('.modal').modal();
});

Template.modal.helpers({
  modalAttributes(uniqueId) {
    return {
      "data-target": uniqueId,
    };
  },
});
