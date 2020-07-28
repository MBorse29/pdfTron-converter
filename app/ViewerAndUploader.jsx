import '@babel/polyfill'
import React from 'react'
import { DropArea } from './DropArea'
// import { toHaveNoViolations } from 'jest-axe'

class App extends React.Component {
  constructor() {
    super()
    this.viewer = React.createRef()
    this.docViewer = null
    this.annotManager = null
    this.instance = null
  }

  componentDidMount() {
    window
      .WebViewer(
        {
          path: '/WebViewer/lib',
          initialDoc: '/sample.pdf',
          fullAPI: true,
        },
        document.getElementById('a'),
      )
      .then(instance => {
        instance.iframeWindow.addEventListener('loaderror', function(err) {
          // Do something with error. eg. instance.showErrorMessage('An error has occurred')
          instance.showErrorMessage('An error has occurred: ', err)
        })
        // at this point, the viewer is 'ready'
        // call methods from instance, docViewer and annotManager as needed
        this.instance = instance
        this.docViewer = instance.docViewer
        this.annotManager = instance.annotManager

        // you can also access major namespaces from the instance as follows:
        // var Tools = instance.Tools;
        // var Annotations = instance.Annotations;

        // now you can access APIs through `this.instance`
        this.instance.openElement('notesPanel')

        // or listen to events from the viewer element
        this.viewer.current.addEventListener('pageChanged', e => {
          const [pageNumber] = e.detail
          console.log(`Current page is ${pageNumber}`)
        })

        // or from the docViewer instance
        this.docViewer.on('annotationsLoaded', () => {
          console.log('annotations loaded')
        })

        // Draw rectangle on PDF
        //this.docViewer.on('documentLoaded', this.wvDocumentLoadedHandler)
      })
  }

  getFileBlob = ({ buffer, type }) => {
    const blob = new Blob([new Uint8Array(buffer)], { type })
    blob.lastModifiedDate = new Date()
    return blob
  }

  convertMsOfficeToPDF = (inputBuffer, fileName) =>
    this.instance.CoreControls.office2PDFBuffer(inputBuffer, {
      l: '', //licence key (getting watermark on final PDF)
    }).then(buffer => {
      const currentBlob = this.getFileBlob({ buffer, type: 'application/pdf' })
      // currentBlob.name = 'sampleDoc'

      // Load Document in Webviewer
      this.instance.loadDocument(currentBlob, { fileName: `${fileName}.pdf` })

      // File Saver
      //window.saveAs(currentBlob, fileName) // FileSaver.min.js
    })

  convertImageToPDF = (buffer, fileName) => {
    const currentBlob = this.getFileBlob({ buffer, type: 'image/jpeg' })

    const reader = new FileReader()
    reader.readAsDataURL(currentBlob)
    reader.onloadend = async () => {
      // result includes identifier 'data:image/png;base64,' plus the base64 data
      //console.log(reader.result)

      const PDFNet = this.instance.PDFNet
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

      const currentBlob = this.getFileBlob({
        buffer: docbuf,
        type: 'application/pdf',
      })

      // Load Document in Webviewer
      this.instance.loadDocument(currentBlob, { fileName: `${fileName}.pdf` })

      // File Saver
      //window.saveAs(currentBlob, fileName)
    }
  }

  onFileSelection = files => {
    console.log('files', files)
    //Currently on single file
    const names = files[0].name.split('.')
    const fileName = names[0]
    const fileExtension = names[names.length - 1].toLowerCase()

    this.instance.PDFNet.initialize()
      .then(() => new Response(files[0]).arrayBuffer())
      .then(inputBuffer => {
        switch (fileExtension) {
          case 'xlsx':
          case 'pptx':
          case 'ppt':
          case 'doc':
          case 'docx':
            this.convertMsOfficeToPDF(inputBuffer, fileName)
            break
          case 'png':
          case 'jpg':
          case 'jpeg':
            this.convertImageToPDF(inputBuffer, fileName)
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

  render() {
    return (
      <div
        className='App'
        style={{
          height: '87vh',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <h3 style={{ marginTop: '150%', maxWidth: 180 }}>
            Upload Document here to convert in PDF format
          </h3>
          <DropArea
            allowMultiple
            onFileSelection={files => {
              this.onFileSelection(files)
            }}
          ></DropArea>
        </div>
        <div style={{ width: '90%' }}>
          <h1>WebViewer</h1>
          <div
            className='webviewer'
            id='a'
            ref={this.viewer}
            style={{ height: '100%', width: '100%', border: '1px solid' }}
          />
        </div>
      </div>
    )
  }
}

export default App
