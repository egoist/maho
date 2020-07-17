import React from 'react'
import { Helmet } from 'react-helmet'

export default () => {
  return (
    <div>
      <Helmet>
        <link rel="stylesheet" href="/style.css" />
      </Helmet>
      <div>Reference a file located at ./public/heart.svg</div>
      <pre>
        <code>{`<img src="/heart.svg" width="100" />`}</code>
      </pre>
      <img src="/heart.svg" width="100" />
    </div>
  )
}
