import React from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet'

export default () => {
  return (
    <div>
      <Helmet>
        <title>Maho App</title>
      </Helmet>
      <h1>Thanks for trying Maho!</h1>
      <div>
        <Link to="/about">About</Link>
      </div>
    </div>
  )
}
