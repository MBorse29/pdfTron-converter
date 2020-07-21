(function(exports) {
  var clicks = 0;

  var line1 = { p1: undefined, p2: undefined };
  var line2 = { p1: undefined, p2: undefined };

  var drawLineFxn1;

  var drawLineFxn2;

  var maxClicks = 2;

  var leftPanelPageIndexToAlign;
  var rightPanelPageIndexToAlign;

  var alignPressedFxn;

  var leftPanelAlignmentSelectionClickHandler;
  var rightPanelAlignmentSelectionClickHandler;

  var isForAlignment = 'isForAlignment';
  var forLeftPanel = 'forLeftPanel';

  function hasXY(point) {
    return point && point.x && point.y;
  }

  function getMouseLocation(instance, e) {
    var scrollElement = instance.docViewer.getScrollViewElement();
    var scrollLeft = scrollElement.scrollLeft || 0;
    var scrollTop = scrollElement.scrollTop || 0;

    return {
      x: e.pageX + scrollLeft,
      y: e.pageY + scrollTop,
    };
  }

  function createEndPointAnnotation(instance, pageIndex, x, y, r, g, b, isForLeftPanel) {
    var Annotations = instance.Annotations;
    var annot = new Annotations.EllipseAnnotation();
    annot.PageNumber = pageIndex + 1;
    // values are in page coordinates with (0, 0) in the top left
    annot.X = x;
    annot.Y = y;
    annot.Width = 7;
    annot.Height = 7;
    annot.Printable = false;
    annot.ReadOnly = true;
    annot.LockedContents = true;
    annot.Locked = true;
    annot[isForAlignment] = true;
    annot[forLeftPanel] = isForLeftPanel;
    annot.FillColor = new Annotations.Color(r, g, b, 1);

    return annot;
  }
  function createLineAnnotation(instance, pageIndex, x1, y1, x2, y2, isForLeftPanel) {
    var Annotations = instance.Annotations;
    var Point = Annotations.Point;
    var lineAnnot = new Annotations.LineAnnotation();
    lineAnnot.PageNumber = pageIndex + 1;
    // values are in page coordinates with (0, 0) in the top left
    lineAnnot.Start = new Point(x1, y1);
    lineAnnot.End = new Point(x2, y2);
    lineAnnot.Width = 7;
    lineAnnot.Height = 7;
    lineAnnot.Printable = false;
    lineAnnot.ReadOnly = true;
    lineAnnot.LockedContents = true;
    lineAnnot.Locked = true;
    lineAnnot[isForAlignment] = true;
    lineAnnot[forLeftPanel] = isForLeftPanel;
    lineAnnot.setEndStyle('OpenArrow');
    return lineAnnot;
  }

  function removeAlignmentAnnotations(instance, isForLeftPanel) {
    var annotManager = instance.annotManager;
    var annotList = annotManager.getAnnotationsList();
    var filteredList = [];
    for (var i = 0; i < annotList.length; i++) {
      var annotation = annotList[i];
      if (annotation[isForAlignment] === true && annotation[forLeftPanel] === isForLeftPanel) {
        filteredList.push(annotation);
      }
    }
    annotManager.deleteAnnotations(filteredList, false, true);
  }

  function drawLine(instance, canvas, lineToUpdate, isForLeftPanel, e) {
    // Convert mouse coord to viewer page coord
    var ctx = canvas.getContext('2d');
    ctx.save();
    var windowPoint = getMouseLocation(instance, e);

    var currPageIndex = instance.docViewer.getCurrentPage() - 1;
    var displayMode = instance.docViewer.getDisplayModeManager().getDisplayMode();
    var viewerPageCoord = displayMode.windowToPage(windowPoint, currPageIndex);
    var annotManager = instance.annotManager;
    var annot;
    if (clicks === 0) {
      annot = createEndPointAnnotation(instance, currPageIndex, viewerPageCoord.x, viewerPageCoord.y, 50, 205, 50, isForLeftPanel);
      lineToUpdate.p1.x = viewerPageCoord.x;
      lineToUpdate.p1.y = viewerPageCoord.y;
    } else if (clicks < maxClicks) {
      removeAlignmentAnnotations(instance, isForLeftPanel);
      var lineAnnotation = createLineAnnotation(instance, currPageIndex, lineToUpdate.p1.x, lineToUpdate.p1.y, viewerPageCoord.x, viewerPageCoord.y, isForLeftPanel);
      annotManager.addAnnotation(lineAnnotation);
      // need to draw the annotation otherwise it won't show up until the page is refreshed
      annotManager.redrawAnnotation(lineAnnotation);
      lineToUpdate.p2.x = viewerPageCoord.x;
      lineToUpdate.p2.y = viewerPageCoord.y;
    }
    if (annot) {
      annotManager.addAnnotation(annot);
      // need to draw the annotation otherwise it won't show up until the page is refreshed
      annotManager.redrawAnnotation(annot);
    }
    clicks++;
    ctx.restore();
  }

  function updatePanelPageIndexToAlign(isLeft, instance) {
    if (clicks === maxClicks) {
      var currPageIndex = instance.docViewer.getCurrentPage() - 1;
      if (isLeft) {
        leftPanelPageIndexToAlign = currPageIndex;
      } else {
        rightPanelPageIndexToAlign = currPageIndex;
      }
    }
  }

  function onAlignPressed(callback) {
    if (line1.p1 && hasXY(line1.p1) && line1.p2 && hasXY(line1.p2) && line2.p1 && hasXY(line2.p1) && line2.p2 && hasXY(line2.p2)) {
      callback(line1.p1, line1.p2, line2.p1, line2.p2, leftPanelPageIndexToAlign, rightPanelPageIndexToAlign);
    }
  }

  function destroyDiffAlignmentToolHandlers(leftPanelInstance, rightPanelInstance) {
    document.getElementById('align').removeEventListener('click', alignPressedFxn);
    document.getElementById('select-alignment-left-panel').removeEventListener('click', leftPanelAlignmentSelectionClickHandler);
    document.getElementById('select-alignment-right-panel').removeEventListener('click', rightPanelAlignmentSelectionClickHandler);

    var documentContainer = leftPanelInstance.viewerElement.querySelector('iframe').contentDocument.querySelector('.DocumentContainer');
    var instance = leftPanelInstance.instance;
    var currPageIndex = instance.docViewer.getCurrentPage() - 1;
    var canvas = documentContainer.querySelector('.canvas' + currPageIndex);
    if (canvas) {
      canvas.parentNode.removeEventListener('click', drawLineFxn1);
    }

    documentContainer = rightPanelInstance.viewerElement.querySelector('iframe').contentDocument.querySelector('.DocumentContainer');
    instance = rightPanelInstance.instance;
    currPageIndex = instance.docViewer.getCurrentPage() - 1;
    canvas = documentContainer.querySelector('.canvas' + currPageIndex);
    if (canvas) {
      canvas.parentNode.removeEventListener('click', drawLineFxn2);
    }
  }

  function initializeDiffAlignmentToolHandlers(leftPanelInstance, rightPanelInstance, onAlignPressedCallback) {
    var me = this;

    var updateLeftPanelPageIndexToAlignFxn = updatePanelPageIndexToAlign.bind(me, true, leftPanelInstance.instance);
    var updateRightPanelPageIndexToAlignFxn = updatePanelPageIndexToAlign.bind(me, false, rightPanelInstance.instance);

    leftPanelAlignmentSelectionClickHandler = function() {
      clicks = 0;
      var documentContainer = leftPanelInstance.viewerElement.querySelector('iframe').contentDocument.querySelector('.DocumentContainer');
      var instance = leftPanelInstance.instance;
      var currPageIndex = instance.docViewer.getCurrentPage() - 1;
      var canvas;
      if (leftPanelPageIndexToAlign) {
        canvas = documentContainer.querySelector('.canvas' + leftPanelPageIndexToAlign);
        if (canvas) {
          canvas.parentNode.removeEventListener('click', drawLineFxn1);
        }
      }
      canvas = documentContainer.querySelector('.canvas' + currPageIndex);
      canvas.parentNode.removeEventListener('click', drawLineFxn1);

      leftPanelPageIndexToAlign = undefined;
      line1.p1 = {};
      line1.p2 = {};
      removeAlignmentAnnotations(instance, true);
      drawLineFxn1 = drawLine.bind(me, leftPanelInstance.instance, canvas, line1, true);
      canvas.parentNode.addEventListener('click', drawLineFxn1);
      canvas.parentNode.removeEventListener('click', updateLeftPanelPageIndexToAlignFxn);
      canvas.parentNode.addEventListener('click', updateLeftPanelPageIndexToAlignFxn);
    };

    rightPanelAlignmentSelectionClickHandler = function() {
      var documentContainer = rightPanelInstance.viewerElement.querySelector('iframe').contentDocument.querySelector('.DocumentContainer');
      var instance = rightPanelInstance.instance;
      var currPageIndex = instance.docViewer.getCurrentPage() - 1;
      var canvas;
      if (rightPanelPageIndexToAlign) {
        canvas = documentContainer.querySelector('.canvas' + rightPanelPageIndexToAlign);
        if (canvas) {
          canvas.parentNode.removeEventListener('click', drawLineFxn2);
        }
      }
      canvas = documentContainer.querySelector('.canvas' + currPageIndex);
      canvas.parentNode.removeEventListener('click', drawLineFxn2);
      clicks = 0;
      rightPanelPageIndexToAlign = undefined;
      line2.p1 = {};
      line2.p2 = {};
      removeAlignmentAnnotations(instance, false);
      drawLineFxn2 = drawLine.bind(me, rightPanelInstance.instance, canvas, line2, false);
      canvas.parentNode.addEventListener('click', drawLineFxn2);
      canvas.parentNode.removeEventListener('click', updateRightPanelPageIndexToAlignFxn);
      canvas.parentNode.addEventListener('click', updateRightPanelPageIndexToAlignFxn);
    };
    document.getElementById('select-alignment-left-panel').addEventListener('click', leftPanelAlignmentSelectionClickHandler);

    alignPressedFxn = onAlignPressed.bind(this, onAlignPressedCallback);

    document.getElementById('select-alignment-right-panel').addEventListener('click', rightPanelAlignmentSelectionClickHandler);
    document.getElementById('align').addEventListener('click', alignPressedFxn);
  }
  exports.DiffAlignmentTool = {
    initializeDiffAlignmentToolHandlers: initializeDiffAlignmentToolHandlers,
    destroyDiffAlignmentToolHandlers: destroyDiffAlignmentToolHandlers,
  };
})(window);
