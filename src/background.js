// This is the background script for the extension
chrome.runtime.onInstalled.addListener(function() {
  // This code runs when the extension is first installed or updated
  console.log('ChatGPT Conversation Exporter extension installed!');
});

// Function to handle when the extension icon is clicked
function handleIconClick() {
  chrome.tabs.create({ url: "popup.html" });
}

// Set up event listener for extension icon click
chrome.browserAction.onClicked.addListener(handleIconClick);

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.message === "exportConversation") {
    try {
      // send the message to content.js to click on the export button
      const tabId = sender.tab.id;
      chrome.tabs.sendMessage(tabId, { message: "clickExportButton" });
      
      // wait for the export to complete and get the URL of the exported file
      const exportedFileUrl = await new Promise((resolve, reject) => {
        chrome.downloads.onChanged.addListener(function listener(downloadDelta) {
          if (downloadDelta.state && downloadDelta.state.current === "complete") {
            resolve(downloadDelta.url);
            chrome.downloads.onChanged.removeListener(listener);
          }
        });
      });
      
      // get the downloaded file's path and extract the JSON files from it
      const downloadedFilePath = await new Promise((resolve, reject) => {
        chrome.downloads.search({ url: exportedFileUrl }, function (results) {
          if (results.length === 1) {
            const downloadedFileId = results[0].id;
            chrome.downloads.show(downloadedFileId, function (showResult) {
              resolve(showResult.filename);
            });
          } else {
            reject("Could not find the downloaded file");
          }
        });
      });
      
      // read the extracted JSON files and send them back to content.js
      const conversations = await readConversationsFromZip(downloadedFilePath);
      sendResponse({ conversations: conversations });
    } catch (error) {
      console.error(error);
      sendResponse({ error: error.message });
    }
  }
});

async function readConversationsFromZip(zipFilePath) {
  const zip = await JSZip.loadAsync(await fetch(zipFilePath).then((response) => response.arrayBuffer()));
  const conversationsFile = await zip.file("conversations.json").async("string");
  return JSON.parse(conversationsFile);
}
