import React, { useEffect, useRef } from 'react'
import PropTypes from 'prop-types'

const Viewer = ({ docPath, docName, fileBlob }) => {
  let viewerInstance = useRef()
  console.log('viewerInstance', viewerInstance)
  useEffect(() => {
    viewerInstance &&
      viewerInstance.loadDocument &&
      viewerInstance.loadDocument(fileBlob, fileBlob.name)
  }, [fileBlob])

  useEffect(() => {
    window
      .WebViewer(
        {
          path: docPath || '/WebViewer/lib',
          initialDoc: docName || '/sample.pdf',
          fullAPI: true,
        },
        document.getElementById('myWebViewer'),
      )
      .then(currentInstance => {
        viewerInstance = currentInstance

        currentInstance.iframeWindow.addEventListener('loaderror', err => {
          // Do something with error. eg. instance.showErrorMessage('An error has occurred')
          currentInstance.showErrorMessage('An error has occurred: ', err)
        })

        // or listen to events from the viewer element
        // viewer.current.addEventListener('pageChanged', e => {
        //   const [pageNumber] = e.detail
        //   console.log(`Current page is ${pageNumber}`)
        // })
      })
  }, [])

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <div
        className='viewerStyles'
        id='myWebViewer'
        // ref={viewerInstance}
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
  fileBlob: PropTypes.object,
}

export default Viewer
