/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

let { Cc, Ci, Cu, Cr } = require('chrome');
let self = require('sdk/self');
let tabs = require('sdk/tabs');

Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource://gre/modules/Downloads.jsm');
Cu.import('resource://gre/modules/osfile.jsm');
Cu.import('resource://gre/modules/Task.jsm');

/**
 * URL where is Stop-It database available for download.
 * @const {String} DB_DOWNLOAD_URL
 */
const DB_DOWNLOAD_URL = 'http://ondrejd.savana-hosting.cz/stop-it/db.sqlite';

/**
 * URL to main add-on's page.
 * @var {String} addonPageUrl
 */
let addonPageUrl = self.data.url('download-page.html');

/**
 * Holds path to the local copy of Stop-It database.
 * @var {String}
 */
let databaseFile = OS.Path.join(OS.Constants.Path.profileDir, 'db.sqlite');

console.log(databaseFile);

/**
 * Download Stop-It database at the first run.
 * @see https://developer.mozilla.org/en-US/docs/Mozilla/JavaScript_code_modules/Downloads.jsm
 * @todo Show user message with result of the operation!
 */
function downloadStopItDatabase() {
	Task.spawn(function () {
		yield Downloads.fetch(
			DB_DOWNLOAD_URL, 
			OS.Path.join(OS.Constants.Path.profileDir, 'db.sqlite')
		);
		
		console.log('Stop-It database has been downloaded.');
	}).then(null, function (aError) {
		console.log(aError);
	});
} // end downloadStopItDatabase()

/**
 * Remove Stop-It database from the file system.
 * @todo Show user message with result of the operation!
 */
function removeStopItDatabase() {
	try {
		OS.File.remove(DB_DOWNLOAD_URL);
	} catch (exception) {
		if (exception instanceof OS.File.Error && exception.becauseNoSuchFile) {
			// The file does not exist
			console.log('Stop-It database can not be removed - file does not exist!');
			console.log(DB_DOWNLOAD_URL);
		}
	}
	// TODO Try also `Task` approach!
	/*Task.spawn(function () {
		yield OS.File.remove(DB_DOWNLOAD_URL);

		console.log('Stop-It database has been removed.');
	}).then(null, function (aError) {
		console.log(aError);
		if (aError instanceof OS.File.Error && aError.becauseNoSuchFile) {
			// The file does not exist
			console.log('Stop-It database can not be removed - file does not exist!');
			console.log(DB_DOWNLOAD_URL);
		}
	});*/
} // end removeStopItDatabase()

/**
 * Prototype object for our listener.
 */
function HttpOnModifyRequestListenerPrototype() {}
HttpOnModifyRequestListenerPrototype.prototype = {
	/**
	 * Observe for "http-on-modify-request" event.
	 * @param {Object} aSubject
	 * @param {String} aTopic
	 * @param {Object} aData
	 */
	observe: function(aSubject, aTopic, aData) {
		console.log('onHttpOnModifyRequestevent');
		console.log(aSubject);
		console.log(aTopic);
		console.log(aData);
	
		let httpChannel = aSubject.QueryInterface(Ci.nsIHttpChannel);
		let requestUrl = httpChannel.URI.spec;
	
		// TODO Get URLs from the database (if it is downloaded)
		let urls = [];
		for (let i=0; i<urls.length; i++) {
			if (requestUrl.indexOf(urls[i]) > -1) {
				// This aborts the load:
				//httpChannel.cancel(Cr.NS_BINDING_ABORTED);
				// This replace contents which browser is loading:
				httpChannel.redirectTo(
					Services.io.newURI(
						'data:text,ILLEGAL_&_DANGEROUS_CONTENT_BLOCKED', 
						null, 
						null
					)
				);
				break;
			}
		}
	} // end observe(aSubject, aTopic, aData)
}; // End of HttpOnModifyRequestListenerPrototype.prototype

/**
 * Called when add-on's download page is ready.
 * @param {Tab} aTab
 */
function onDownloadPageReady(aTab) {
	let worker = aTab.attach({
		contentScriptFile: self.data.url('download-page.js'),
	});

	worker.port.emit('load');
} // end onDownloadPageReady()

/**
 * Show page that informs about progress of downloading Stop-It database.
 */
function showDownloadPage() {
	// Check if page is already opened - if yes bring it to the foreground.
	for (let i=0; i<tabs.length; i++) {
		if (tabs[i].url == addonPageUrl) {
			tabs[i].activate();
			return;
		}
	}

	// Page is not opened yet - open it
	tabs.open({
		url: addonPageUrl,
		onReady: onDownloadPageReady
	});
} // end showDownloadPage()

// Check if exists Stop-It database and download it if not
if (OS.File.exists(databaseFile) !== true) {
	showDownloadPage();
}

// ==========================================================================
// Generated by JPM:
// a dummy function, to show how tests work.
// to see how to test this function, look at test/test-index.js
//function dummy(text, callback) {
//	callback(text);
//}
//
//exports.dummy = dummy;
