import '@babel/polyfill'
import React from 'react'
import { render } from 'react-dom'
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
          initialDoc: '/dummy.pdf',
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

        this.docViewer.on('documentLoaded', this.wvDocumentLoadedHandler)
      })
  }

  convertMsOfficeToPDF = (inputBuffer, fileName) =>
    this.instance.CoreControls.office2PDFBuffer(inputBuffer, {
      l: '', //licence key (getting watermark on final PDF)
    }).then(buffer => {
      const arr = new Uint8Array(buffer)
      const currentBlob = new Blob([arr], { type: 'application/pdf' })
      currentBlob.lastModifiedDate = new Date()
      // currentBlob.name = 'sampleDoc'
      window.saveAs(currentBlob, fileName) // FileSaver.min.js
    })

  convertImageToPDF = (inputBuffer, fileName) => {
    const arr = new Uint8Array(inputBuffer)
    const currentBlob = new Blob([arr], { type: 'image/jpeg' })

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

      const arr = new Uint8Array(docbuf)
      const currentBlob = new Blob([arr], { type: 'application/pdf' })
      currentBlob.lastModifiedDate = new Date()

      window.saveAs(currentBlob, fileName)
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
        console.log('File downloaded successfully!')
      })
      .catch(err => {
        console.log('An error was encountered! :(', err)
      })
  }

  wvDocumentLoadedHandler = () => {
    // call methods relating to the loaded document
    const { Annotations } = this.instance
    const rectangle = new Annotations.RectangleAnnotation()
    rectangle.PageNumber = 1
    rectangle.X = 100
    rectangle.Y = 100
    rectangle.Width = 250
    rectangle.Height = 250
    rectangle.StrokeThickness = 5
    rectangle.Author = this.annotManager.getCurrentUser()
    this.annotManager.addAnnotation(rectangle)
    this.annotManager.drawAnnotations(rectangle.PageNumber)
    // see https://www.pdftron.com/api/web/WebViewer.html for the full list of low-level APIs
  }

  render() {
    return (
      <div className='App' style={{ height: '90vh' }}>
        <div className='header'>React sample</div>
        <DropArea
          allowMultiple
          onFileSelection={files => {
            this.onFileSelection(files)
          }}
        ></DropArea>

        <div
          className='webviewer'
          id='a'
          ref={this.viewer}
          style={{
            // height: '100%',
            border: '1px solid',
            height: 0,
            position: 'absolute',
            bottom: 0,
          }}
        />
      </div>
    )
  }
}

render(<App />, document.getElementById('root'))
