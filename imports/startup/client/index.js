// This specially named file allows us to export whatever is necessary
// from this file, while `import`ing only the directory (`.../client`)
// containing it.

// All of the routes (different templates) a client can go to.
import './router.js';

// Data subscriptions that are independent of page.
import './constant_subscriptions.js';