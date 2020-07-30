import React, { Fragment, useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { DropArea } from './DropArea'
import Viewer from './Viewer'

const ViewerWithMultipleDocs = () => {
  const [blob, setBlob] = useState(null)
  return (
    <Fragment>
      <DropArea
        onFileSelection={files => {
          console.log('current one', files[0])
          setBlob(files[0])
        }}
      />
      <Viewer fileBlob={blob || {}} />
    </Fragment>
  )
}

export default ViewerWithMultipleDocs
