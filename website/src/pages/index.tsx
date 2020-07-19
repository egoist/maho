import React from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet'

export default () => {
  const [slug, setSlug] = React.useState('foo/bar')
  return (
    <div>
      <Helmet>
        <title>home</title>
      </Helmet>
      <h1>home page</h1>
      <ul>
        <li>
          <Link to="/about">About</Link>
        </li>
        <li>
          <Link to="/hehe">404</Link>
        </li>
        <li>
          <input value={slug} onChange={(e) => setSlug(e.target.value)} />
          <Link to={`/docs/${slug}`}>docs/{slug}</Link>
        </li>
      </ul>
    </div>
  )
}
