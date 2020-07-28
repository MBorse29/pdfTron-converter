import '@babel/polyfill'
import React from 'react'
import { render } from 'react-dom'
import { BrowserRouter as Router, Switch, Route, Link } from 'react-router-dom'
import ViewerAndUploader from './ViewerAndUploader'
import Viewer from './Viewer'

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
            <ViewerAndUploader />
          </Route>
          <Route path='/uploader'>
            <div>Uploader + Converter</div>
          </Route>
          <Route path='/'>
            <Viewer />
          </Route>
        </Switch>
      </div>
    </Router>
  )
}

render(<Application />, document.getElementById('root'))
