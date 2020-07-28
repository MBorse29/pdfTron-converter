import React, { useEffect, useRef } from 'react'
import PropTypes from 'prop-types'
import { DropArea } from './DropArea'

const UploaderConverter = () => {
  let viewer = useRef()

  useEffect(() => {
    window
      .WebViewer(
        {
          path: '/WebViewer/lib',
          initialDoc: '/sample.pdf',
          fullAPI: true,
        },
        document.getElementById('hiddenViewer'),
      )
      .then(currentInstance => {
        viewer = currentInstance

        currentInstance.iframeWindow.addEventListener('loaderror', err => {
          currentInstance.showErrorMessage('An error has occurred: ', err)
        })
      })
  }, [])

  const getFileBlob = ({ buffer, type }) => {
    const blob = new Blob([new Uint8Array(buffer)], { type })
    blob.lastModifiedDate = new Date()
    return blob
  }

  const convertMsOfficeToPDF = (inputBuffer, fileName) =>
    viewer.CoreControls.office2PDFBuffer(inputBuffer, {
      l: '', //licence key (getting watermark on final PDF)
    }).then(buffer => {
      const currentBlob = getFileBlob({ buffer, type: 'application/pdf' })
      // currentBlob.name = 'sampleDoc'

      // Load Document in Webviewer
      //viewer.loadDocument(currentBlob, { fileName: `${fileName}.pdf` })

      // File Saver
      window.saveAs(currentBlob, fileName) // FileSaver.min.js
    })

  const convertImageToPDF = (buffer, fileName) => {
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
      await matrix2.set(200, 0, 0, 250, 50, 500)
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
      //viewer.loadDocument(currentBlob, { fileName: `${fileName}.pdf` })

      // File Saver
      window.saveAs(currentBlob, fileName)
    }
  }

  const onFileSelection = files => {
    console.log('files', files)
    //Currently on single file
    const names = files[0].name.split('.')
    const fileName = names[0]
    const fileExtension = names[names.length - 1].toLowerCase()

    viewer.PDFNet.initialize()
      .then(() => new Response(files[0]).arrayBuffer())
      .then(inputBuffer => {
        switch (fileExtension) {
          case 'xlsx':
          case 'pptx':
          case 'ppt':
          case 'doc':
          case 'docx':
            convertMsOfficeToPDF(inputBuffer, fileName)
            break
          case 'png':
          case 'jpg':
          case 'jpeg':
            convertImageToPDF(inputBuffer, fileName)
            break
          default:
            alert(`${fileExtension} files not handled yet`)
        }
      })
      .then(() => {
        console.log('File Conversion successfully!')
      })
      .catch(err => {
        console.log('An error was encountered! :(', err)
      })
  }
  return (
    <div>
      <h3>Upload Document here to convert in PDF format</h3>
      <DropArea
        onFileSelection={files => {
          onFileSelection(files)
        }}
      ></DropArea>
      <div id='hiddenViewer' style={{ display: 'none' }}></div>
    </div>
  )
}

UploaderConverter.propTypes = {
  onConversion: PropTypes.func,
}

export default UploaderConverter
