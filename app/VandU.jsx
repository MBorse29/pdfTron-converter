import React, { useEffect, useRef } from 'react'
import PropTypes from 'prop-types'
import { DropArea } from './DropArea'
import WebViewer from '@pdftron/webviewer'

const VandU = ({
  styles,
  hideViewer,
  downloadOnConvert,
  loadOnConvert,
  initialDoc,
  onFilesConvert,
}) => {
  let viewer = useRef()

  useEffect(() => {
    WebViewer(
      {
        path: `/${initialDoc.path}`,
        initialDoc: `/${initialDoc.name}`,
        fullAPI: true,
      },
      document.getElementById('docViewer'),
    ).then(currentInstance => {
      viewer = currentInstance

      currentInstance.iframeWindow.addEventListener('loaderror', err => {
        currentInstance.showErrorMessage('An error has occurred: ', err)
      })

      // or listen to events from the viewer element
      currentInstance.iframeWindow.addEventListener('pageChanged', e => {
        const [pageNumber] = e.detail
        console.log(`Current page is ${pageNumber}`)
      })
    })
  }, [])

  const getFileBlob = ({ buffer, type }) => {
    const blob = new Blob([new Uint8Array(buffer)], { type })
    blob.lastModifiedDate = new Date()
    return blob
  }

  const saveFile = (blob, fileName) => {
    downloadOnConvert && window.saveAs(blob, fileName)
  }

  const loadDocumentInViewer = (blob, fileName) => {
    loadOnConvert && viewer.loadDocument(blob, { fileName: `${fileName}.pdf` })
  }

  const forwardToParent = (blob, fileName) => {
    blob.name = fileName
    typeof onFilesConvert === 'function' && onFilesConvert(blob)
  }

  const convertMsOfficeToPDF = (inputBuffer, fileName) => {
    return viewer.CoreControls.office2PDFBuffer(inputBuffer, {
      extension: 'pdf',
      l: '', //licence key (getting watermark on final PDF)
    }).then(buffer => {
      const currentBlob = getFileBlob({ buffer, type: 'application/pdf' })

      // Load Document in Webviewer
      loadDocumentInViewer(currentBlob, fileName)

      // Returned converted document
      forwardToParent(currentBlob, fileName)

      // File Saver
      saveFile(currentBlob, fileName) // FileSaver.min.js

      return currentBlob
    })
  }

  const convertImageToPDF = (buffer, fileName) => {
    return new Promise((resolve, reject) => {
      const currentBlob = getFileBlob({ buffer, type: 'image/jpeg' })

      const reader = new FileReader()
      reader.readAsDataURL(currentBlob)
      reader.onloadend = async () => {
        // result includes identifier 'data:image/png;base64,' plus the base64 data
        //console.log(reader.result)

        const PDFNet = viewer.PDFNet
        const doc = await PDFNet.PDFDoc.create()
        doc.initSecurityHandler()
        doc.lock()

        const builder = await PDFNet.ElementBuilder.create() // ElementBuilder, used to build new element Objects
        // create a new page writer that allows us to add/change page elements
        const writer = await PDFNet.ElementWriter.create() // ElementWriter, used to write elements to the page
        // define new page dimensions
        const pageRect = await PDFNet.Rect.init(0, 0, 612, 794)
        let page = await doc.pageCreate(pageRect)

        writer.beginOnPage(page, PDFNet.ElementWriter.WriteMode.e_overlay)

        // Adding a JPEG image to output file
        let img = await PDFNet.Image.createFromURL(doc, reader.result)
        let matrix = await PDFNet.Matrix2D.create(200, 0, 0, 250, 50, 500)
        const matrix2 = await PDFNet.Matrix2D.createZeroMatrix()
        await matrix2.set(500, 0, 0, 350, 50, 250)
        let element = await builder.createImageFromMatrix(img, matrix2)
        element.setTextMatrix(matrix)
        writer.writePlacedElement(element)

        writer.end()
        doc.pagePushBack(page) // add the page to the document

        const docbuf = await doc.saveMemoryBuffer(
          PDFNet.SDFDoc.SaveOptions.e_linearized,
        )

        const currentBlob = getFileBlob({
          buffer: docbuf,
          type: 'application/pdf',
        })

        // Load Document in Webviewer
        loadDocumentInViewer(currentBlob, fileName)

        // Returned converted document
        forwardToParent(currentBlob, fileName)

        // File Saver
        saveFile(currentBlob, fileName)

        resolve(currentBlob)
      }
    })
  }

  const getArrayBuffer = fileInstance =>
    new Response(fileInstance).arrayBuffer()

  const convertToPDF = ({ currentFile, fileName, fileExtension }) => {
    return getArrayBuffer(currentFile).then(inputBuffer => {
      switch (fileExtension) {
        case 'xlsx':
        case 'pptx':
        case 'ppt':
        case 'doc':
        case 'docx':
          return convertMsOfficeToPDF(inputBuffer, fileName)
        case 'png':
        case 'jpg':
        case 'jpeg':
        case 'odt':
          return convertImageToPDF(inputBuffer, fileName)
        default:
          alert(`${fileExtension} files not handled yet`)
      }
    })
    // .then((convertedDoc)=>convertedDoc)
  }

  const onFileSelection = files => {
    console.log('files', files)
    //Currently on single file

    viewer.PDFNet.initialize()
      .then(() =>
        Promise.all(
          Array.from(files).map(currentFile => {
            const names = currentFile.name.split('.')
            const fileName = names[0]
            const fileExtension = names[names.length - 1].toLowerCase()
            return convertToPDF({ currentFile, fileName, fileExtension })
          }),
        ),
      )
      .then(convertedDoc => {
        console.log('File Conversion successfully!', convertedDoc)
      })
      .catch(err => {
        console.log('An error was encountered! :(', err)
      })
  }

  return (
    <div style={styles.parent}>
      <div style={styles.uploader}>
        <DropArea
          onFileSelection={files => {
            onFileSelection(files)
          }}
          allowMultiple
        ></DropArea>
      </div>
      <div
        style={{
          height: '100vh',
          width: '100%',
          border: '1px solid',
          ...styles.viewer,
          display: hideViewer ? 'none' : 'block',
        }}
        id='docViewer'
        ref={viewer}
      ></div>
    </div>
  )
}

VandU.defaultProps = {
  styles: { parent: {}, viewer: {}, uploader: {} },
  initialDoc: {
    path: 'WebViewer/lib',
    name: 'sample.pdf',
  },
}

VandU.propTypes = {
  hideViewer: PropTypes.bool,
  downloadOnConvert: PropTypes.bool,
  loadOnConvert: PropTypes.bool,
  styles: PropTypes.object,
  initialDoc: PropTypes.object,
  onFilesConvert: PropTypes.func,
}

export default VandU
