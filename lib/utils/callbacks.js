export const Callbacks = {
	leftGame: function(err, result) {
        if (err) {
            Materialize.toast(err.reason, 3000, 'error-toast');
            return;
        }

        if (result.notLoggedOn) {
            Materialize.toast('You\'re not logged in.', 3000, 'error-toast');
            return;
        } else if (result.notInRoom) {
            Materialize.toast('You need to be in a room to leave.', 3000, 'error-toast');
            return;
        } else if (result.success) {
            Router.go('home');
        }
	},
};
