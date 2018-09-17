import './modal.html';

import '/imports/ui/common/button.js';

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
