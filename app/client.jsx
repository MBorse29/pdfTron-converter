import '@babel/polyfill'
import React from 'react'
import { render } from 'react-dom'
import { BrowserRouter as Router, Switch, Route, Link } from 'react-router-dom'
import VandU from './VandU'
// import Viewer from './Viewer'
import ViewerWithMultipleDocs from './ViewerWithMultipleDocs'

const Application = () => {
  return (
    <Router>
      <div>
        <nav>
          <ul>
            <li>
              <Link to='/'>Web Viewer</Link>
            </li>
            <li>
              <Link to='/uploader'>File Uploader + Converter</Link>
            </li>
            <li>
              <Link to='/viewPlusUpload'>
                Web Viewer + File Uploader + Converter
              </Link>
            </li>
          </ul>
        </nav>

        {/* A <Switch> looks through its children <Route>s and
          renders the first one that matches the current URL. */}
        <Switch>
          <Route path='/viewPlusUpload'>
            <VandU
              // hideViewer
              // downloadOnConvert
              loadOnConvert
              onFilesConvert={blobs => console.log('blobs', blobs)}
              styles={{
                parent: { padding: 20 },
                uploader: { marginBottom: 20 },
                viewer: { height: 'calc(100vh - 250px)' },
              }}
            />
          </Route>
          <Route path='/uploader'>
            <VandU
              hideViewer
              onFilesConvert={blobs => console.log('blobs', blobs)}
            />
          </Route>
          <Route path='/'>
            <ViewerWithMultipleDocs />
            {/* <Viewer /> */}
          </Route>
        </Switch>
      </div>
    </Router>
  )
}

render(<Application />, document.getElementById('root'))
