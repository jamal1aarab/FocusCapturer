// screenshot.js
function setScreenshotUrls(htmlElements, message, screenshotFocusedUrls, comparisonResult) {
  document.getElementById('message').textContent = message;

  const container = document.querySelector('.container');

  // Function to create and append an image element
  function appendImage(src) {
    const img = document.createElement('img');
    img.alt = src ? 'Screenshot preview' : 'No screenshot available';
    img.src = src || 'white.png';
    img.height = 240;
    img.width = 240;
    container.appendChild(img);
  }

  // Function to create and append a title element
  function appendTitle(title) {
    const h2 = document.createElement('h2');
    h2.textContent = title;
    container.appendChild(h2);
  }

  // Function to create and append a code block element
  function appendCode(code) {
    const pre = document.createElement('pre');
    const codeElement = document.createElement('code');
    codeElement.textContent = code; // Use textContent to escape HTML characters
    pre.appendChild(codeElement);
    container.appendChild(pre);
  }

  // Iterate through comparison results and append images for false results
  comparisonResult.forEach((hasFocus, index) => {
    if (!hasFocus) {
      appendTitle(`Element N° ${index + 1} does not have focus`);
      appendCode(htmlElements[index]);
      appendImage(screenshotFocusedUrls[index]);
    }
  });
}

// Listener for messages from the service worker
chrome.runtime.onMessage.addListener(function (request) {
  if (request.msg === 'screenshot') {
    setScreenshotUrls(
      request.data.htmlElements,
      request.data.message,
      request.data.screenshotFocusedUrls,
      request.data.comparisonResult
    );
  }
});
