/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Download is going to start
self.port.on('download_started', function() {
	var pane1 = document.getElementById('pane1'); 
	pane1.style.display = 'block';
});

// Download progress is changed
self.port.on('download_changed', function(aDownload) {
	if (aDownload.hasProgress !== true) {
		return;
	}

	var bar = document.getElementById('progressBar');
	bar.style.width = aDownload.progress + '%';

	var lbl = document.getElementById('progressBarLabel');
	lbl.innerHTML = aDownload.progress + ' %';
});

// Downloading succeeded
self.port.on('download_succeeded', function() {
	var bar = document.getElementById('progressBar');
	bar.style.width = '100%';

	var lbl = document.getElementById('progressBarLabel');
	lbl.innerHTML = '100 %';

	var pane1 = document.getElementById('pane1');
	pane1.style.display = 'none';

	var pane2 = document.getElementById('pane2');
	pane2.style.display = 'block';

	var closeButton = pane2.getElementsByTagName('button')[0];
	closeButton.addEventListener('click', function() {
		self.port.emit('close_page');
	});
});

// Download was not downloaded
self.port.on('download_errored', function() {
	var pane1 = document.getElementById('pane1');
	pane1.style.display = 'none';

	var pane3 = document.getElementById('pane3');
	pane3.style.display = 'block';

	var closeButton = pane3.getElementsByTagName('button')[0];
	closeButton.addEventListener('click', function() {
		self.port.emit('close_page');
	});
});
