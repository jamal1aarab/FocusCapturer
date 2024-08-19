// screenshot.js
function setScreenshotUrls(htmlElements, message, screenshotFocusedUrls, comparisonResult,screenshotUrls) {
  document.getElementById('message').textContent = message;

  // Get the container element
  const container = document.querySelector('.container');

  function appendImage(src) {
    const img = document.createElement('img');
    img.alt = src ? 'Screenshot preview' : 'No screenshot available';
    img.src = src || 'white.png';
    img.height = 240;
    img.width = 240;
    container.appendChild(img);
  }

  function appendTitle(title) {
    const h2 = document.createElement('h2');
    h2.textContent = title;
    container.appendChild(h2);
  }

  function appendCode(code) {
    const pre = document.createElement('pre');
    const codeElement = document.createElement('code');
    codeElement.textContent = code; 
    pre.appendChild(codeElement);
    container.appendChild(pre);
  }

  // process the comparison result
  comparisonResult.forEach((hasFocus, index) => {
    if (!hasFocus) {
      appendTitle(`Element N° ${index + 1} does not have visible focus`);
      appendCode(htmlElements[index]);
      appendImage(screenshotFocusedUrls[index]);
      appendImage(screenshotUrls[index]);
    }
    else {
      appendTitle(`Element N° ${index + 1} has visible focus`);
      appendCode(htmlElements[index]);
      appendImage(screenshotFocusedUrls[index]);
      appendImage(screenshotUrls[index]);
    }
  });
}



// communication with service worker
chrome.runtime.onMessage.addListener(function (request) {
  if (request.msg === 'screenshot') {
    setScreenshotUrls(
      request.data.htmlElements,
      request.data.message,
      request.data.screenshotFocusedUrls,
      request.data.comparisonResult,
      request.data.screenshotUrls
    );
  }
});
