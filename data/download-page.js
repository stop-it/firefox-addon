/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// ...

// ==========================================================================
// Below are listeners for events emitted from the main script.

// ...
self.port.on('load', function() {
	console.log('[page.js]: load');
});
