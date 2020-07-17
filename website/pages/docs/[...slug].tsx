import React from 'react'
import { Link } from 'react-router-dom'
import { useRouteData, LoadFunction } from 'maho'

export const load: LoadFunction = async ({ params }) => {
  if (!process.browser) {
    const { default: fetch } = await import('node-fetch')
    const users = await fetch(`http://jsonplaceholder.typicode.com/users`).then((res) =>
      res.json(),
    )
    const date = new Date()
    return {
      title: 'Getting Started',
      content: `hi ${params['*']}`,
      users,
      date: date.toISOString()
    }
  }
  return {}
}

export default () => {
  const data = useRouteData()
  return (
    <div>
      <Link to="/">Home</Link>
      <h1>{data.title}</h1>
      <h2>{data.content}</h2>
      <h3>{data.date}</h3>
      <ul>
        {data.users.map((user: any) => (
          <li key={user.username}>{user.username}</li>
        ))}
      </ul>
    </div>
  )
}
