function setScreenshotUrls(htmlElement, screenshotUrls, screenshotFocusedUrls) {
  document.getElementById('html-target').innerHTML = htmlElement;

  const container = document.querySelector('.container');
  


  // Function to create and append an img element
  function appendImage(src) {
    const img = document.createElement('img');
    img.src = src;
    img.alt = 'Screenshot preview';
    img.height = 480;
    container.appendChild(img);
  }

  // Append the main screenshots
  if (screenshotUrls && screenshotUrls.length > 0) {
    appendImage(screenshotUrls[0]);
  } else {
    appendImage('white.png'); // Default image if no URLs provided
  }

  // Append focused screenshots
  if (screenshotFocusedUrls && screenshotFocusedUrls.length > 0) {
    appendImage(screenshotFocusedUrls[0]);
  } else {
    appendImage('white.png'); // Default image if no URLs provided
  }

  // Append additional screenshots dynamically
  for (let i = 1; i < screenshotUrls.length && i < screenshotFocusedUrls.length; i++) {
    appendImage(screenshotUrls[i]);
    appendImage(screenshotFocusedUrls[i]);
  }
}

chrome.runtime.onMessage.addListener(function (request) {
  if (request.msg === 'screenshot') {
    setScreenshotUrls(request.data.htmlElement, request.data.screenshotUrls, request.data.screenshotFocusedUrls);
  }
});
