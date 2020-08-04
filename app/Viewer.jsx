import React, { useEffect, useRef } from 'react'
import PropTypes from 'prop-types'
import WebViewer from '@pdftron/webviewer'

const Viewer = ({ docPath, docName, getViewerReference }) => {
  let viewerInstance = useRef()

  useEffect(() => {
    WebViewer(
      {
        path: docPath || '/WebViewer/lib',
        initialDoc: docName || '/sample.pdf',
        fullAPI: true,
      },
      document.getElementById('myWebViewer'),
    ).then(currentInstance => {
      typeof getViewerReference === 'function' &&
        getViewerReference(currentInstance)

      currentInstance.iframeWindow.addEventListener('loaderror', err => {
        // Do something with error. eg. instance.showErrorMessage('An error has occurred')
        currentInstance.showErrorMessage('An error has occurred: ', err)
      })

      // or listen to events from the viewer element
      currentInstance.iframeWindow.addEventListener('pageChanged', e => {
        const [pageNumber] = e.detail
        console.log(`Current page is ${pageNumber}`)
      })
    })
  }, [])

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <div
        id='myWebViewer'
        ref={viewerInstance}
        style={{
          height: 'calc(100vh - 200px)',
          width: '100%',
          border: '1px solid',
        }}
      />
    </div>
  )
}

Viewer.propTypes = {
  docPath: PropTypes.string,
  docName: PropTypes.string,
  getViewerReference: PropTypes.func,
}

export default Viewer
