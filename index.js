/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

let { Cc, Ci, Cu, Cr } = require('chrome');
let self = require('sdk/self');
let tabs = require('sdk/tabs');
let events = require('sdk/system/events');

Cu.import('resource://gre/modules/Downloads.jsm');
Cu.import('resource://gre/modules/osfile.jsm');
Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource://gre/modules/Sqlite.jsm');
Cu.import('resource://gre/modules/Task.jsm');

/**
 * URL where is Stop-It database available for download.
 * @const {String} DB_DOWNLOAD_URL
 */
const DB_DOWNLOAD_URL = 'http://ondrejd.savana-hosting.cz/stop-it/db.sqlite';

/**
 * Holds path to the local copy of Stop-It database.
 * @const {String}
 */
const DB_FILE_PATH = OS.Path.join(OS.Constants.Path.profileDir, 'stop-it.sqlite');

/**
 * URL of our download page.
 * @var {String} ADDON_PAGE_URL
 */
const ADDON_PAGE_URL = self.data.url('download-page.html');

/**
 * String with our blocked URL addresses.
 * @var {String} Urls
 */
let Urls = '';

/**
 * Indicates if blocked URL addresses are already loaded.
 * @var {Boolean} UrlsAreInitialized
 */
let UrlsAreInitialized = false;

/**
 * Download Stop-It database at the first run.
 * @param {Worker} aWorker
 */
function downloadDatabase(aWorker) {
	Task.spawn(function () {
		let list = yield Downloads.getList(Downloads.PRIVATE);
		//let list = yield Downloads.getList(Downloads.ALL);
		let view = {
			onDownloadChanged: function (aDownload) {
				if (aDownload.succeeded === true) {
					aWorker.port.emit('download_succeeded');
					loadBlockedUrls();
				} else {
					let downloadInfo = {
						currentBytes: aDownload.currentBytes,
						totalBytes: aDownload.totalBytes
					};

					if (aDownload.hasProgress === true) {
						downloadInfo.hasProgress = true;
						downloadInfo.progress = aDownload.progress;
					}

					aWorker.port.emit('download_changed', downloadInfo);
				}
			}
		};
		yield list.addView(view);

		let options = { source: DB_DOWNLOAD_URL, target: DB_FILE_PATH };
		let download = yield Downloads.createDownload(options);
		list.add(download);

		download.start().then(function () {
				list.remove(download);
				list.removeView(view); 
		});

		aWorker.port.emit('download_started');
	}).then(
		null,
		function (error) {
			console.log(error);
			aWorker.port.emit('download_errored');
		}
	);
} // end downloadDatabase(aWorker)

/**
 * Show page that informs about downloading of Stop-It database.
 */
function showDownloadPage() {
	tabs.open({
		url: ADDON_PAGE_URL,
		/**
		 * Called when add-on's download page is ready.
		 * @param {Tab} aTab
		 */
		onReady: function onDownloadPageReady(aTab) {
			// Attach page worker
			let worker = aTab.attach({
				contentScriptFile: self.data.url('download-page.js'),
			});

			// Listen for request for closing download page
			worker.port.on('close_page', function() {
				aTab.close();
			});

			// And start downloading
			downloadDatabase(worker);
		} // end onDownloadPageReady(aTab)
	});
} // end showDownloadPage()

/**
 * Load all blocked URL addresses from the database to one big text.
 */
function loadBlockedUrls() {
	Task.spawn(
		function* loadUrls() {
			let conn = yield Sqlite.openConnection({ path: DB_FILE_PATH }); 
	
			try {
				let result = yield conn.execute(
					'SELECT group_concat(trim(Url)) FROM Urls ORDER BY Url ASC '
				);

				Urls = result[0].getResultByIndex(0);
			} catch(e) {
				console.log(e.message);
			} finally {
				yield conn.close();
			}
		}
	).then(
		function () {
			if (Urls !== '') {
				console.log('Blocked URL addresses are successfully loaded!');
				UrlsAreInitialized = true;
			}
		}
	);
} // end loadBlockedUrls()

/**
 * Listener for HTTP requests - this is what blocking the bad URLs.
 * @param {Event} aEvent
 */
function onHttpOnModifyRequestListener(aEvent) {
	if (UrlsAreInitialized !== true) {
		//console.log('Blocked URL addresses are not loaded yet!');
		return;
	}

	let httpChannel = aEvent.subject.QueryInterface(Ci.nsIHttpChannel);
	let referrerUrlHost = (httpChannel.referrer) ? httpChannel.referrer.host : '';
	let requestUrlHost = httpChannel.URI.host;

	//console.log('Investigating loading of: "' + requestUrlHost + '", referrer: "' + referrerUrlHost + '"');

	// Test if URL should be blocked
	if (Urls.indexOf(requestUrlHost) >= 0) {
		//console.log('URL "' + requestUrlHost + '" is blocked!');

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
	}

	//console.log('URL is not blocked.');
} // end onHttpOnModifyRequestListener(aEvent)

/**
 * Listener for application quit.
 * @param {Event} aEvent
 */
function onApplicationQuitListener(aEvent) {
	// Remove our listeners
	events.off('quit-application', onApplicationQuitListener);
	events.off('http-on-modify-request', onHttpOnModifyRequestListener);
} // end onApplicationQuitListener(aEvent)

// ==========================================================================
// Here is "start-up" code:

// Main event listeners
events.on('http-on-modify-request', onHttpOnModifyRequestListener);
events.on('quit-application', onApplicationQuitListener);

// TODO This would be better after 'app-startup' event or something like this,
//      but there is no proper one.
//      See: https://developer.mozilla.org/en-US/docs/Observer_Notifications

// Check if Stop-It database exists
if (OS.File.exists(DB_FILE_PATH) !== true) {
	// And start download if not
	showDownloadPage();
} else {
	// Load all URLs at once and store them as a text!
	loadBlockedUrls();
}
