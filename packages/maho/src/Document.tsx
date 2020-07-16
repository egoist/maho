import React from 'react'
import { useMahoContext } from './context'

export default ({ Main, Scripts }: any) => {
  return (
    <Html>
      <Head />
      <Body>
        <Main />
        <Scripts />
      </Body>
    </Html>
  )
}

export const Body: React.FC = ({ children }) => {
  const { helmet } = useMahoContext()
  return <body {...helmet.bodyAttributes.toComponent()}>{children}</body>
}

export const Html: React.FC = ({ children }) => {
  const { helmet } = useMahoContext()
  return <html {...helmet.htmlAttributes.toComponent()}>{children}</html>
}

export const Head: React.FC = () => {
  const { helmet } = useMahoContext()
  return (
    <head>
      <meta charSet="utf-8" />
      {helmet.title.toComponent()}
      {helmet.meta.toComponent()}
      {helmet.link.toComponent()}
    </head>
  )
}
