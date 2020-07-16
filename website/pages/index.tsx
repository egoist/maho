import React from 'react'
import {Link} from 'react-router-dom'
import {Helmet} from 'react-helmet'

export default () => {
  return <div>
    <Helmet>
      <title>home</title>
    </Helmet>
    <h1>home page</h1>
    <div>
      <Link to="/about">About</Link>
      <Link to="/hehe">404</Link>
    </div>
  </div>
}
