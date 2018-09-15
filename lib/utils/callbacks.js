export const Callbacks = {
	leftGame: function(err, result) {
        if (err) {
            M.toast({html: err.reason, displayLength: 3000, classes: 'error-toast'});
            return;
        }

        if (result.notLoggedOn) {
            M.toast({html: 'You\'re not logged in.', displayLength: 3000, classes: 'error-toast'});
            return;
        } else if (result.notInRoom) {
            M.toast({html: 'You need to be in a room to leave.', displayLength: 3000, classes: 'error-toast'});
            return;
        } else if (result.success) {
            FlowRouter.go('home');
        }
	},
};
