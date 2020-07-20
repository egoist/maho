import React from 'react'
import { LoadFunction, useRouteData } from '../../../packages/maho'

export const load: LoadFunction = async () => {
  if (process.browser) return {}

  const { default: axios } = await import('axios')
  const res = await axios.get(`http://hn.algolia.com/api/v1/search?query=story`)
  return {
    items: res.data.hits,
  }
}

export default () => {
  const data = useRouteData()
  return (
    <div>
      {data.items.map((item: any) => {
        return <div key={item.objectID}>{item.title}</div>
      })}
    </div>
  )
}
