import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'

const DropArea = ({
  children,
  supportedTypes,
  allowMultiple,
  onFileSelection,
}) => {
  let [dragCounter, setDragCounter] = useState(0)
  const [drag, setDrag] = useState(false)
  const dropRef = React.createRef()

  useEffect(() => {
    let div = dropRef.current
    if (children) {
      div.addEventListener('dragenter', handleDragIn)
      div.addEventListener('dragleave', handleDragOut)
      div.addEventListener('dragover', handleDrag)
      div.addEventListener('drop', handleDrop)
    }
    return () => {
      if (children) {
        div.removeEventListener('dragenter', handleDragIn)
        div.removeEventListener('dragleave', handleDragOut)
        div.removeEventListener('dragover', handleDrag)
        div.removeEventListener('drop', handleDrop)
      }
    }
  })

  const handleDrag = e => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDragIn = e => {
    e.preventDefault()
    e.stopPropagation()
    setDragCounter(++dragCounter)
    e.dataTransfer.items && e.dataTransfer.items.length && setDrag(true)
  }

  const handleDragOut = e => {
    e.preventDefault()
    e.stopPropagation()
    setDragCounter(--dragCounter)
    dragCounter === 0 && setDrag(false)
  }

  const handleDrop = e => {
    e.preventDefault()
    e.stopPropagation()
    setDrag(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length) {
      handleDropItems(e.dataTransfer.files)
      e.dataTransfer.clearData()
      setDragCounter(0)
    }
  }

  const isMultipleFileIssue = files => !!(!allowMultiple && files.length > 1)

  const getTypesString = supportedTypes =>
    supportedTypes && supportedTypes.length
      ? supportedTypes.toString().toLowerCase()
      : ''

  const isFileTypesIssue = files => {
    const supportedTypesString = getTypesString(supportedTypes)
    let isFileTypeIssue = false
    if (supportedTypesString) {
      Array.from(files).forEach(({ name }) => {
        let fileExtension = `.${name
          .toLowerCase()
          .split('.')
          .pop()}`

        if (!supportedTypesString.includes(fileExtension)) {
          isFileTypeIssue = true
        }
      })
    }
    return isFileTypeIssue
  }

  const handleDropItems = files => {
    if (isMultipleFileIssue(files)) {
      alert(`Multiple files are not allowed!`)
      return
    }

    if (isFileTypesIssue(files)) {
      alert(`File type is not supported!`)
      return
    }

    files.length && onFileSelection(files)
  }

  const getInputElement = () => {
    return (
      <input
        type='file'
        id='uploadFileComponent'
        style={{ display: 'none' }}
        multiple={!!allowMultiple}
        accept={getTypesString(supportedTypes)}
        onChange={({ target }) => handleDropItems(target.files)}
      />
    )
  }

  const supportedTypesString = getTypesString(supportedTypes)
  return !children ? (
    <div>
      <button
        onClick={() => document.getElementById('uploadFileComponent').click()}
      >
        Upload Documents
      </button>
      {getInputElement()}
    </div>
  ) : (
    <div
      ref={dropRef}
      htmlFor='uploadFileComponent'
      onClick={() => document.getElementById('uploadFileComponent').click()}
      title={
        supportedTypesString && `Supported file types: ${supportedTypesString}`
      }
    >
      {children({ isDragActive: drag })}
      {getInputElement()}
    </div>
  )
}

DropArea.propTypes = {
  /** DropArea will act as a wrapper component where the user wants to drag files.
   * If no child found then it renders an input element that is of the file type to select files.
   */
  children: PropTypes.any,
  /** Callback use to get selected files.  */
  onFileSelection: PropTypes.func.isRequired,
  /** It indicates whether multiple file selection is allowed or not. */
  allowMultiple: PropTypes.bool,
  /** This array will use to provide supported file types to drop area.
   * If the file type uploaded is not listed here then it will alert the user.
   */
  supportedTypes: PropTypes.array,
}

export { DropArea }
