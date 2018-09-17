// This specially named file allows us to export whatever is necessary
// from this file, while `import`ing only the directory (`.../server`)
// containing it.

// This file contains the code we want to run whenever the server starts.
import './on_startup.js';

// This file defines all the collections, publications and methods that
// the application provides as an API to the client.
import './define_server_api.js';

// This file sets some general security settings for the server.
import './security.js';