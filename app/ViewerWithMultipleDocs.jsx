import React, { Fragment, useState } from 'react'
import { DropArea } from './DropArea'
import Viewer from './Viewer'

const ViewerWithMultipleDocs = () => {
  // let instance = useRef()
  const [ref, setRef] = useState(null)
  const setInstance = ref => setRef(ref)
  const [file, setFile] = useState(null)
  return (
    <Fragment>
      <DropArea
        onFileSelection={files => {
          console.log('current one', files[0])
          ref && ref.loadDocument(files[0], files[0].name)
          setFile(files[0])
        }}
      />
      <Viewer getViewerReference={setInstance} />
    </Fragment>
  )
}

export default ViewerWithMultipleDocs
