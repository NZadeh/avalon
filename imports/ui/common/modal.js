import './modal.html';

import '/imports/ui/common/button.js';

Template.buttonModal.helpers({
  modalAttributes(uniqueId) {
    return {
      "data-target": uniqueId,
    };
  },
});

Template.triggeredModal.onRendered(function() {
  // This code is necessary to "initialize" each modal that will eventually
  // pop up. Note that when the modal div becomes part of the HTML is when this
  // function will be called. This is different from when the modal becomes
  // *visible*, which requires a call to `M.Modal.getInstance(...).open()`
  // or a click on a `button.modal-trigger` in the case of `buttonModal`.
  const modalHtml = document.querySelector(`#${this.data.uniqueId}`);
  M.Modal.init(modalHtml);
});
