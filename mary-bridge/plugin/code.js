figma.showUI(__html__, { width: 400, height: 420, title: 'MARY Bridge' });

// Load saved server URL
figma.clientStorage.getAsync('bridge-url').then(url => {
  figma.ui.postMessage({ type: 'loaded-url', url: url || '' });
});

figma.ui.onmessage = async (msg) => {

  // Save server URL
  if (msg.type === 'save-url') {
    await figma.clientStorage.setAsync('bridge-url', msg.url);
    return;
  }

  // Execute code sent from bridge server via Claude
  if (msg.type === 'exec') {
    const { jobId, code } = msg;

    try {
      // Load fonts
      await Promise.all([
        figma.loadFontAsync({ family: "Inter", style: "Regular" }),
        figma.loadFontAsync({ family: "Inter", style: "Medium" }),
        figma.loadFontAsync({ family: "Inter", style: "Bold" }),
        figma.loadFontAsync({ family: "Inter", style: "Semi Bold" }),
      ]);

      const fn = new Function('figma', code);
      await fn(figma);

      figma.viewport.scrollAndZoomIntoView(figma.currentPage.children);

      figma.ui.postMessage({
        type: 'exec-result',
        jobId,
        text: 'Frames added successfully'
      });

    } catch (e) {
      figma.ui.postMessage({
        type: 'exec-error',
        jobId,
        error: e.message
      });
    }
  }
};
