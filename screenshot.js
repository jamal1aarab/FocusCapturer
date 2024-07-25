function setScreenshotUrls(htmlElement, screenshotUrls, screenshotFocusedUrls) {
  document.getElementById('html-target').innerHTML = htmlElement;

  const container = document.querySelector('.container');



  // Function to create and append an img element
  function appendImage(src) {
    const img = document.createElement('img');

    img.alt = 'Screenshot preview';
    img.height = 480;

    if (src == null) {
      src = 'white.png';
      img.alt = 'No screenshot available';
      img.height = 240;
      img.width = 240;
    }
    img.src = src;
    container.appendChild(img);
  }



  // Append additional screenshots dynamically
  for (let i = 0; i < screenshotUrls.length && i < screenshotFocusedUrls.length; i++) {
    appendImage(screenshotUrls[i]);
    appendImage(screenshotFocusedUrls[i]);
  }
}

chrome.runtime.onMessage.addListener(function (request) {
  if (request.msg === 'screenshot') {
    setScreenshotUrls(request.data.htmlElement, request.data.screenshotUrls, request.data.screenshotFocusedUrls);
  }
});
