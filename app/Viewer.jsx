import React, { useEffect, useRef } from 'react'
import PropTypes from 'prop-types'

const Viewer = ({ ref, docPath, docName }) => {
  let viewer = ref || useRef()

  useEffect(() => {
    window
      .WebViewer(
        {
          path: docPath || '/WebViewer/lib',
          initialDoc: docName || '/sample.pdf',
          fullAPI: true,
        },
        document.getElementById('a'),
      )
      .then(currentInstance => {
        currentInstance.iframeWindow.addEventListener('loaderror', err => {
          // Do something with error. eg. instance.showErrorMessage('An error has occurred')
          currentInstance.showErrorMessage('An error has occurred: ', err)
        })

        // or listen to events from the viewer element
        viewer.current.addEventListener('pageChanged', e => {
          const [pageNumber] = e.detail
          console.log(`Current page is ${pageNumber}`)
        })
      })
  }, [])

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <h1>WebViewer</h1>
      <div
        className='viewerStyles'
        id='a'
        ref={viewer}
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
  ref: PropTypes.object,
  docPath: PropTypes.string,
  docName: PropTypes.string,
}

export default Viewer
