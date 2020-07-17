import React from 'react'

export default () => {
  return (
    <div>
      <div>Reference a file located at ./public/heart.svg</div>
  <pre><code>{`<img src="/heart.svg" width="100" />`}</code></pre>
      <img src="/heart.svg" width="100" />
    </div>
  )
}
