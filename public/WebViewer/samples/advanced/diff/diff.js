// @link WebViewerInstance: https://www.pdftron.com/api/web/WebViewerInstance.html
// @link WebViewerInstance.loadDocument: https://www.pdftron.com/api/web/WebViewerInstance.html#loadDocument__anchor

// @link DocumentViewer: https://www.pdftron.com/api/web/CoreControls.DocumentViewer.html
// @link DocumentViewer.getViewportRegionRect: https://www.pdftron.com/api/web/CoreControls.DocumentViewer.html#getViewportRegionRect__anchor
// @link DocumentViewer.getCurrentPage: https://www.pdftron.com/api/web/CoreControls.DocumentViewer.html#getCurrentPage__anchor

// @link CoreControls: https://www.pdftron.com/api/web/CoreControls.html
// @link PartRetrievers: https://www.pdftron.com/api/web/PartRetrievers.html

// @link Document: https://www.pdftron.com/api/web/CoreControls.Document.html
// @link Document.loadAsync: https://www.pdftron.com/api/web/CoreControls.Document.html#loadAsync__anchor
// @link Document.cancelLoadCanvas: https://www.pdftron.com/api/web/CoreControls.Document.html#cancelLoadCanvas__anchor
(function(exports) {
  CoreControls.setWorkerPath('../../../lib/core');

  var originalScroller = null;
  var scrollTimeout;

  var pdfWorkerTransportPromise;
  var officeWorkerTransportPromise;
  var currentLoadCanvas = {};
  var lastRenderRect = {};
  var viewers = [];
  var instances = {};

  var DEFAULT_TRANSFORMATION_MATRIX = {
    a: 1,
    b: 0,
    c: 0,
    d: 1,
    e: 0,
    f: 0,
  };

  // Used to figure out smallest scale value > 0
  // so that canvase won't appear inverted
  var minScaleVal;

  var PANEL_IDS = {
    LEFT_PANEL: 'leftPanel',
    MID_PANEL: 'middlePanel',
    RIGHT_PANEL: 'rightPanel',
  };

  var VIEWER_IDS = [{ panel: PANEL_IDS.LEFT_PANEL }, { panel: PANEL_IDS.MID_PANEL }, { panel: PANEL_IDS.RIGHT_PANEL }];

  var TRANSFORMATION_DELTA = 1;

  // Keeps track of the original canvas for each page
  // so that it can be retrieved easily when applying a transformation via nudge tool
  var originalRightPanelCanvases = [];

  var initialRotation;

  var line1Start;
  var line1End;
  var line2Start;
  var line2End;
  var alignedCanvasDrawing;
  var firstDocIndex;
  var secondDocIndex;
  var shouldDiff = true;

  function hasPointsForAlignment() {
    return line1Start !== undefined && line1End !== undefined && line2Start !== undefined && line2End !== undefined && alignedCanvasDrawing !== undefined;
  }

  function allowViewPortRendering(allow) {
    var midPanelInstance = instances[PANEL_IDS.MID_PANEL].instance;
    if (allow) {
      midPanelInstance.docViewer.setViewportRenderMode(true);
      midPanelInstance.setMaxZoomLevel('9999%');
    } else {
      midPanelInstance.docViewer.setViewportRenderMode(false);
      var maxZoomLvl = 5;
      midPanelInstance.setMaxZoomLevel(maxZoomLvl);
      if (midPanelInstance.getZoomLevel() > maxZoomLvl) {
        midPanelInstance.setZoomLevel(maxZoomLvl);
      }
    }
  }

  function nudgeCanvas(pageIndex, canvasContext) {
    var transformationToApply = exports.NudgeTool.getPageTransformationState(pageIndex);
    if (transformationToApply) {
      var instance = instances[PANEL_IDS.MID_PANEL].instance;
      var newScale = exports.DiffUtil.getScaleForCanvasFromNudgeTool(transformationToApply.scaling);
      if (newScale >= 0) {
        minScaleVal = newScale;
      }
      var pageMatrix = exports.DiffAlignment.retrievePageMatrix(instance, pageIndex);
      pageMatrix = exports.DiffUtil.decomposeMatrix(pageMatrix);
      // shift it if necessary so that we are always rotating around the point "(0,0)" of the rotated canvas
      canvasContext.translate(pageMatrix.translateX, pageMatrix.translateY);
      var transformedCoords = exports.DiffUtil.computeNewCoordsFromZoomRotation(
        instance.docViewer.getZoom(),
        instance.docViewer.getRotation(),
        transformationToApply.horizontalTranslation,
        transformationToApply.verticalTranslation
      );
      canvasContext.translate(transformedCoords[0], transformedCoords[1]);
      canvasContext.rotate((transformationToApply.rotation * Math.PI) / 180);
      canvasContext.scale(minScaleVal, minScaleVal);
      canvasContext.translate(-pageMatrix.translateX, -pageMatrix.translateY);
    }
    return canvasContext;
  }

  function nudgeAlignedCanvas(pageIndex, canvasContext) {
    var transformationToApply = exports.NudgeTool.getPageTransformationState(pageIndex);
    if (transformationToApply) {
      var newScale = exports.DiffUtil.getScaleForCanvasFromNudgeTool(transformationToApply.scaling);
      if (newScale >= 0) {
        minScaleVal = newScale;
      }
      canvasContext.translate(transformationToApply.horizontalTranslation, transformationToApply.verticalTranslation);
      canvasContext.rotate((transformationToApply.rotation * Math.PI) / 180);
      canvasContext.scale(minScaleVal, minScaleVal);
    }
    return canvasContext;
  }

  function renderMidPanelOverlay(firstDocIndex, secondDocIndex, middleSecondDocToDraw, desiredWidth, desiredHeight, firstDocCanvasMatrix, secondDocCanvasMatrix, shouldDiff) {
    if (!originalRightPanelCanvases[secondDocIndex]) {
      return;
    }

    var midPanelFirstDocCanvas = instances[PANEL_IDS.MID_PANEL].documentContainer.querySelector('.canvas' + firstDocIndex);
    if (!midPanelFirstDocCanvas) {
      return;
    }

    var diffCanvas = function(firstDocCanvas) {
      var canvasMultiplier = instances[PANEL_IDS.MID_PANEL].instance.iframeWindow.utils.getCanvasMultiplier();

      var enlargedMidPanelSecondDocCanvas = exports.DiffUtil.createCanvas(desiredWidth, desiredHeight, canvasMultiplier);
      var enlargedMidPanelSecondDocCanvasCtx = enlargedMidPanelSecondDocCanvas.getContext('2d');
      enlargedMidPanelSecondDocCanvasCtx.setTransform(
        secondDocCanvasMatrix.a,
        secondDocCanvasMatrix.b,
        secondDocCanvasMatrix.c,
        secondDocCanvasMatrix.d,
        secondDocCanvasMatrix.e,
        secondDocCanvasMatrix.f
      );
      if (hasPointsForAlignment()) {
        enlargedMidPanelSecondDocCanvasCtx = nudgeAlignedCanvas(firstDocIndex, enlargedMidPanelSecondDocCanvasCtx);
      } else {
        enlargedMidPanelSecondDocCanvasCtx = nudgeCanvas(firstDocIndex, enlargedMidPanelSecondDocCanvasCtx);
      }
      enlargedMidPanelSecondDocCanvasCtx.drawImage(middleSecondDocToDraw, 0, 0);

      var enlargedMidPanelFirstDocCanvas = exports.DiffUtil.createCanvas(desiredWidth, desiredHeight, canvasMultiplier);
      var enlargedMidPanelFirstDocCanvasCtx = enlargedMidPanelFirstDocCanvas.getContext('2d');
      enlargedMidPanelFirstDocCanvasCtx.setTransform(firstDocCanvasMatrix.a, firstDocCanvasMatrix.b, firstDocCanvasMatrix.c, firstDocCanvasMatrix.d, firstDocCanvasMatrix.e, firstDocCanvasMatrix.f);
      enlargedMidPanelFirstDocCanvasCtx.drawImage(firstDocCanvas, 0, 0);

      var midPanelFirstDocImgData = enlargedMidPanelFirstDocCanvasCtx.getImageData(0, 0, enlargedMidPanelFirstDocCanvas.width, enlargedMidPanelFirstDocCanvas.height).data;

      var result;
      if (shouldDiff) {
        result = exports.DiffUtil.diffPixels(enlargedMidPanelSecondDocCanvas, enlargedMidPanelFirstDocCanvas, midPanelFirstDocImgData);
      } else {
        result = exports.DiffUtil.overlayPixels(enlargedMidPanelSecondDocCanvas, enlargedMidPanelFirstDocCanvas, midPanelFirstDocImgData);
      }
      result.style.position = 'absolute';
      // copy over left and top so that on zoom the diffed canvas is still shown properly
      result.style.left = firstDocCanvas.style.left;
      result.style.top = firstDocCanvas.style.top;
      result.style.width = desiredWidth / canvasMultiplier + 'px';
      result.style.height = desiredHeight / canvasMultiplier + 'px';
      result.style.zIndex = 25;
      result.style.backgroundColor = 'white';
      result.classList.add('canvasOverlay');

      var existingOverlay = midPanelFirstDocCanvas.parentNode.querySelector('.canvasOverlay');
      if (existingOverlay) {
        existingOverlay.parentNode.removeChild(existingOverlay);
      }
      midPanelFirstDocCanvas.parentNode.appendChild(result);

      // If a multi paged document is loaded
      // Increase the page container's width and height so that it can correctly display the enlarged diff image
      // and so it won't overflow into the next page
      if (instances[PANEL_IDS.MID_PANEL].instance.getPageCount() > 1) {
        var pageSection = instances[PANEL_IDS.MID_PANEL].documentContainer.querySelector('#pageSection' + firstDocIndex);
        pageSection.style.width = desiredWidth + 'px';
        pageSection.style.height = desiredHeight + 'px';

        var pageContainer = instances[PANEL_IDS.MID_PANEL].documentContainer.querySelector('#pageContainer' + firstDocIndex);
        pageContainer.style.width = desiredWidth + 'px';
        pageContainer.style.height = desiredHeight + 'px';
      }
    };
    if (hasPointsForAlignment()) {
      // load whole canvas for that alignment and diffing can be done correctly
      // if zoomed in a lot, midPanelFirstDocCanvas will only give the view port of the document container
      instances[PANEL_IDS.LEFT_PANEL].instance.docViewer.getDocument().loadCanvasAsync({
        pageIndex: firstDocIndex,
        pageRotation: instances[PANEL_IDS.MID_PANEL].instance.docViewer.getRotation(),
        getZoom: function() {
          return instances[PANEL_IDS.MID_PANEL].instance.docViewer.getZoom();
        },
        drawComplete: function(firstDocCanvas) {
          diffCanvas(firstDocCanvas);
        },
      });
    } else {
      diffCanvas(midPanelFirstDocCanvas);
    }
  }

  function createDiffedAlignedCanvas(firstDocIndex, secondDocIndex, canvasToAlign) {
    var midPanelFirstDocCanvas = instances[PANEL_IDS.MID_PANEL].documentContainer.querySelector('.canvas' + firstDocIndex);
    if (!midPanelFirstDocCanvas) {
      return;
    }

    var canvasMultiplier = instances[PANEL_IDS.MID_PANEL].instance.iframeWindow.utils.getCanvasMultiplier();

    var pageMatrix = exports.DiffAlignment.retrievePageMatrix(instances[PANEL_IDS.MID_PANEL].instance, firstDocIndex);
    var canvasForLineAlignment = exports.DiffAlignment.createCanvasForLineAlignment(
      canvasToAlign.width,
      canvasToAlign.height,
      pageMatrix,
      line2Start,
      line2End,
      line1Start,
      line1End,
      canvasMultiplier
    );
    var canvasMatrix = canvasForLineAlignment.getContext('2d').getTransform();

    // Construct the minimum canvas size needed to hold the image from the left doc and right doc
    var matrix = [
      [canvasMatrix.a, canvasMatrix.c, canvasMatrix.e],
      [canvasMatrix.b, canvasMatrix.d, canvasMatrix.f],
      [0, 0, 1],
    ];

    // [minX, maxX, minY, maxY]
    var alignedCanvasBoundingBox = exports.DiffAlignment.createBoundingBoxFromTransformationMatrix(matrix, 0, 0, canvasToAlign.width, canvasToAlign.height);

    var minX = Math.min(0, alignedCanvasBoundingBox[0]);
    var maxX = Math.max(midPanelFirstDocCanvas.width, alignedCanvasBoundingBox[2]);
    var minY = Math.min(0, alignedCanvasBoundingBox[1]);
    var maxY = Math.max(midPanelFirstDocCanvas.height, alignedCanvasBoundingBox[3]);
    // Its possible that x,y coords of the bounding box are negative
    // If they are negative translate all coordinates such that the top left corner is at 0,0
    var deltaX = -1 * minX;
    var deltaY = -1 * minY;

    minX += deltaX;
    maxX += deltaX;

    minY += deltaY;
    maxY += deltaY;

    // If a translation is done, account for that translation in the transformation matrix as well
    var secondDocMatrix = canvasMatrix;
    secondDocMatrix.e += deltaX;
    secondDocMatrix.f += deltaY;

    var firstDocMatrix = {
      a: 1,
      b: 0,
      c: 0,
      d: 1,
      e: deltaX,
      f: deltaY,
    };

    renderMidPanelOverlay(firstDocIndex, secondDocIndex, canvasToAlign, maxX, maxY, firstDocMatrix, secondDocMatrix, shouldDiff);
  }

  function updatePage(doc, documentContainer, instance, pageIndex) {
    var firstDocCanvas = documentContainer.querySelector('.canvas' + pageIndex);
    if (!firstDocCanvas || pageIndex > doc.getPageCount() - 1) {
      return;
    }
    var isViewportRender = firstDocCanvas.style.left !== '';
    return doc.loadCanvasAsync({
      pageIndex: pageIndex,
      pageRotation: instance.docViewer.getRotation(),
      getZoom: function() {
        return instance.docViewer.getZoom();
      },
      drawComplete: function(pageCanvas) {
        originalRightPanelCanvases[pageIndex] = pageCanvas;
        if (!hasPointsForAlignment()) {
          renderMidPanelOverlay(pageIndex, pageIndex, pageCanvas, pageCanvas.width, pageCanvas.height, DEFAULT_TRANSFORMATION_MATRIX, DEFAULT_TRANSFORMATION_MATRIX, shouldDiff);
        }
        currentLoadCanvas[pageIndex] = null;
        if (initialRotation === undefined || initialRotation === null) {
          initialRotation = instance.docViewer.getCompleteRotation(pageIndex + 1);
        }
      },
      renderRect: isViewportRender ? Object.assign({}, lastRenderRect[pageIndex]) : undefined,
    });
  }

  function update(panel, pageIndex) {
    var newDoc = instances[panel].newDoc;
    var documentContainer = instances[panel].documentContainer;
    var instance = instances[panel].instance;

    if (currentLoadCanvas[pageIndex]) {
      newDoc.cancelLoadCanvas(currentLoadCanvas[pageIndex]);
    }
    currentLoadCanvas[pageIndex] = updatePage(newDoc, documentContainer, instance, pageIndex);
  }

  // Create an instance of worker transport to share among WebViewer instances
  function getWorkerTransportPromise(path) {
    // String or file
    var filename = typeof path === 'object' ? path.name : path || '';
    var isOfficeFile = filename.endsWith('docx') || filename.endsWith('pptx') || filename.endsWith('xlsx');

    // Use existing workers
    if (isOfficeFile && officeWorkerTransportPromise) {
      return officeWorkerTransportPromise;
    }

    if (!isOfficeFile && pdfWorkerTransportPromise) {
      return pdfWorkerTransportPromise;
    }

    return CoreControls.getDefaultBackendType().then(function(backendType) {
      if (path && isOfficeFile) {
        officeWorkerTransportPromise = CoreControls.initOfficeWorkerTransports(backendType, {});

        return officeWorkerTransportPromise;
      }

      // Use PDF worker by default
      pdfWorkerTransportPromise = CoreControls.initPDFWorkerTransports(backendType, {});

      return pdfWorkerTransportPromise;
    });
  }

  function loadDocument(panel, docLocation) {
    var CoreControls = instances[panel].instance.CoreControls;

    CoreControls.createDocument(docLocation, { workerTransportPromise: getWorkerTransportPromise(docLocation) }).then(function(newDoc) {
      instances[panel] = Object.assign({}, instances[panel], { newDoc: newDoc });
    });
  }

  function openDoc(panel, firstPdf, secondPdf) {
    var instance = instances[panel].instance;
    instance.loadDocument(firstPdf);

    if (panel === PANEL_IDS.MID_PANEL && secondPdf) {
      loadDocument(panel, secondPdf);
    }
  }

  // Synchronizes zooming of WebViewer instances
  function syncZoom(zoom) {
    viewers.forEach(function(item) {
      var instance = instances[item.panel].instance;

      if (instance.getZoomLevel() !== zoom) {
        instance.setZoomLevel(zoom);
      }
    });
  }

  // Synchronizes scrolling of WebViewer instances
  function syncScrolls(scrollLeft, scrollTop) {
    viewers.forEach(function(item) {
      const documentContainer = instances[item.panel].documentContainer;

      if (!documentContainer) {
        return;
      }

      if (documentContainer.scrollLeft !== scrollLeft) {
        documentContainer.scrollLeft = scrollLeft;
      }

      if (documentContainer.scrollTop !== scrollTop) {
        documentContainer.scrollTop = scrollTop;
      }
    });
  }

  // Synchronizes rotation of the page
  function syncRotation(rotation) {
    viewers.forEach(function(item) {
      var instance = instances[item.panel].instance;

      if (instance.docViewer.getRotation() !== rotation) {
        instance.docViewer.setRotation(rotation);
      }
    });
  }

  function alignLineSegments(line1StartPoint, line1EndPoint, line2StartPoint, line2EndPoint, leftPageIndexToAlign, rightPageIndexToAlign) {
    line1Start = line1StartPoint;
    line1End = line1EndPoint;
    line2Start = line2StartPoint;
    line2End = line2EndPoint;
    firstDocIndex = leftPageIndexToAlign;
    secondDocIndex = rightPageIndexToAlign;

    var canvas = originalRightPanelCanvases[rightPageIndexToAlign];
    if (!canvas) {
      return;
    }

    instances[PANEL_IDS.MID_PANEL].newDoc.loadCanvasAsync({
      pageIndex: secondDocIndex,
      // load canvas with pdf at 0 degrees of rotation so that it can be applied to returned canvas
      // else rotation will be applied twice
      pageRotation: (4 - initialRotation) % 4,
      drawComplete: function(pageCanvas) {
        // set view port render mode to be false for smooth scrolling at high zoom level
        // likewise for setting max zoom level
        allowViewPortRendering(false);
        alignedCanvasDrawing = pageCanvas;
        // the middle panel canvas will be diffed as a side effect
        exports.NudgeTool.setPageTransformationState(firstDocIndex, 0, 0, exports.DiffUtil.getScaleStateForNudgeToolFromCanvas(1), 0);
      },
    });
  }

  // Create an instance of WebViewer
  function setupViewer(item) {
    return new Promise(function(resolve) {
      var viewerElement = document.getElementById(item.panel);

      WebViewer(
        {
          path: '../../../lib',
          css: './nudge-tool.css',
          // share a single instance of the worker transport
          workerTransportPromise: getWorkerTransportPromise(item.pdf),
          initialDoc: item.pdf || null,
          isReadOnly: true,
          disabledElements: ['layoutButtons', 'pageTransitionButtons'],
        },
        viewerElement
      ).then(function(instance) {
        var docViewer = instance.docViewer;

        docViewer.on('documentLoaded', function() {
          instance.setLayoutMode(instance.LayoutMode.Single);
          instance.setFitMode(instance.FitMode.FitWidth);
          if (!instances[item.panel].documentContainer) {
            var documentContainer = viewerElement.querySelector('iframe').contentDocument.querySelector('.DocumentContainer');
            instances[item.panel] = Object.assign({}, instances[item.panel], {
              documentContainer: documentContainer,
            });

            // Sync all WebViewer instances when scroll changes
            documentContainer.onscroll = function() {
              if (!hasPointsForAlignment() && (!originalScroller || originalScroller === documentContainer)) {
                originalScroller = documentContainer;
                syncScrolls(documentContainer.scrollLeft, documentContainer.scrollTop);
                clearTimeout(scrollTimeout);
                scrollTimeout = setTimeout(function() {
                  originalScroller = null;
                }, 50);
              }
            };
          }
        });

        // Update zoom value of the WebViewer instances
        docViewer.on('zoomUpdated', function(zoom) {
          if (!hasPointsForAlignment()) {
            syncZoom(zoom);
          }
        });

        // Update rotation value of the WebViewer instances
        docViewer.on('rotationUpdated', function(rotation) {
          if (!hasPointsForAlignment()) {
            syncRotation(rotation);
          }
        });

        viewers.push(item);

        instances[item.panel] = {
          instance: instance,
          viewerElement: viewerElement,
        };

        resolve();
      });
    });
  }

  function onNudgeToolStateChange() {
    var instance = instances[PANEL_IDS.MID_PANEL].instance;
    var currPageIndex = instance.docViewer.getCurrentPage() - 1;

    var nudgeToolState = exports.NudgeTool.getPageTransformationState(hasPointsForAlignment() ? firstDocIndex : currPageIndex);
    var totalStateValues = 0;
    // use pre-es5 as this code isn't polyfilled and it needs to work in IE11
    // eslint-disable-next-line no-restricted-syntax
    for (var key in nudgeToolState) {
      if (nudgeToolState.hasOwnProperty(key)) {
        var value = nudgeToolState[key];
        totalStateValues += value;
        if (totalStateValues !== 0) {
          break;
        }
      }
    }

    allowViewPortRendering(!hasPointsForAlignment() && totalStateValues === 0);
    if (hasPointsForAlignment()) {
      createDiffedAlignedCanvas(firstDocIndex, secondDocIndex, alignedCanvasDrawing);
    } else {
      var originalRightPanelCanvas = originalRightPanelCanvases[currPageIndex];
      renderMidPanelOverlay(
        currPageIndex,
        currPageIndex,
        originalRightPanelCanvas,
        originalRightPanelCanvas.width,
        originalRightPanelCanvas.height,
        DEFAULT_TRANSFORMATION_MATRIX,
        DEFAULT_TRANSFORMATION_MATRIX,
        shouldDiff
      );
    }
  }

  function initializeViewers(array, callback) {
    var pageCompleteRenderRect = {};

    Promise.all(array.map(setupViewer)).then(function() {
      var instance = instances[PANEL_IDS.MID_PANEL].instance;

      instance.disableElements(['leftPanelButton', 'searchButton', 'searchPanel', 'searchOverlay']);

      var checkboxElement = {
        type: 'customElement',
        render: function() {
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.checked = shouldDiff;
          checkbox.addEventListener('change', function() {
            shouldDiff = !shouldDiff;
            onNudgeToolStateChange();
          });
          return checkbox;
        },
      };
      var checkboxLabelElement = {
        type: 'customElement',
        render: function() {
          const label = document.createElement('label');
          label.innerHTML = 'Show difference';
          return label;
        },
      };
      instance.setHeaderItems(function(header) {
        var items = header.getItems();
        items.splice(items.length - 2, 0, checkboxElement);
        items.splice(items.length - 2, 0, checkboxLabelElement);
        items.splice(items.length - 2, 0, { type: 'divider' });
        header.update(items);
      });

      instance.docViewer.on('pageComplete', function(completedPageIndex) {
        pageCompleteRenderRect[completedPageIndex] = lastRenderRect[completedPageIndex];
        update(PANEL_IDS.MID_PANEL, completedPageIndex);
      });

      instance.docViewer.on('beginRendering', function() {
        var pageIndex = instance.docViewer.getCurrentPage() - 1;
        lastRenderRect[pageIndex] = instance.docViewer.getViewportRegionRect(pageIndex);
        if (currentLoadCanvas[pageIndex]) {
          var newDoc = instances[PANEL_IDS.MID_PANEL].newDoc;
          newDoc.cancelLoadCanvas(currentLoadCanvas[pageIndex]);
        }
      });

      instance.docViewer.on('finishedRendering', function() {
        var displayMode = instance.docViewer.getDisplayModeManager().getDisplayMode();
        var visiblePages = displayMode.getVisiblePages();

        visiblePages.forEach(function(pageIndex) {
          lastRenderRect[pageIndex] = pageCompleteRenderRect[pageIndex];
          update(PANEL_IDS.MID_PANEL, pageIndex);
        });

        if (hasPointsForAlignment()) {
          // re-align after zoom / rotation is done

          var midPanelFirstDocCanvas = instances[PANEL_IDS.MID_PANEL].documentContainer.querySelector('.canvas' + firstDocIndex);
          if (midPanelFirstDocCanvas) {
            // hide the original page as it takes some time to load the aligned canvas
            midPanelFirstDocCanvas.style.opacity = '0';
          }
          instances[PANEL_IDS.MID_PANEL].newDoc.loadCanvasAsync({
            pageIndex: secondDocIndex,
            // load canvas witih pdf at 0 degrees of rotation so that it can be applied to returned canvas
            // else rotation will be applied twice
            pageRotation: (4 - initialRotation) % 4,
            drawComplete: function(pageCanvas) {
              createDiffedAlignedCanvas(firstDocIndex, secondDocIndex, pageCanvas);
            },
          });
        }
      });

      return callback();
    });
  }

  function initialize(firstPdfRelPath, secondPdfRelPath) {
    exports.DiffAlignmentTool.destroyDiffAlignmentToolHandlers(instances[PANEL_IDS.LEFT_PANEL], instances[PANEL_IDS.RIGHT_PANEL]);
    initialRotation = undefined;
    alignedCanvasDrawing = undefined;
    line1Start = undefined;
    line1End = undefined;
    line2Start = undefined;
    line2End = undefined;
    firstDocIndex = 0;
    secondDocIndex = 0;
    openDoc(PANEL_IDS.MID_PANEL, firstPdfRelPath, secondPdfRelPath);
    openDoc(PANEL_IDS.LEFT_PANEL, firstPdfRelPath);
    openDoc(PANEL_IDS.RIGHT_PANEL, secondPdfRelPath);

    originalRightPanelCanvases = [];
    exports.NudgeTool.resetPageTransformationStates();
    exports.DiffAlignmentTool.initializeDiffAlignmentToolHandlers(instances[PANEL_IDS.LEFT_PANEL], instances[PANEL_IDS.RIGHT_PANEL], alignLineSegments);
  }

  // Initialize WebViewer instances
  initializeViewers(VIEWER_IDS, function() {
    initialize(window.location.href + '../../../samples/files/test_doc_1.pdf', window.location.href + '../../../samples/files/test_doc_2.pdf');
    exports.NudgeTool.initNudgeTool(instances[PANEL_IDS.MID_PANEL].instance, TRANSFORMATION_DELTA, onNudgeToolStateChange);
  });

  document.getElementById('selectControl').onclick = function(e) {
    e.preventDefault();
    var select1 = document.getElementById('select1');
    var firstPdf = select1.options[select1.selectedIndex].value;
    var select2 = document.getElementById('select2');
    var secondPdf = select2.options[select2.selectedIndex].value;
    initialize(window.location.href + firstPdf, window.location.href + secondPdf);
  };

  document.getElementById('url-form').onsubmit = function(e) {
    e.preventDefault();

    var firstPdf = document.getElementById('url').value;
    var secondPdf = document.getElementById('url2').value;
    initialize(firstPdf, secondPdf);
  };

  document.getElementById('file-picker-form').onsubmit = function(e) {
    e.preventDefault();
    var firstPdf = document.forms['file-picker-form'][0].files[0];
    var secondPdf = document.forms['file-picker-form'][1].files[0];
    initialize(firstPdf, secondPdf);
  };
})(window);
