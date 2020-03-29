import './button.html';

Template.wideDangerButton.helpers({
    makeDangerous: function(classes) {
        return classes +  " red accent-2";
    }
});
