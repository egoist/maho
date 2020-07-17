# Maho

A framework for building server-rendered or static websites, powered by React and [esbuild](https://github.com/evanw/esbuild).

This framework is not production-ready yet, since esbuild itself is not mature enough, (but [evanw](https://github.com/evanw) is working on that).

![maho](https://user-images.githubusercontent.com/8784712/87699412-68451a80-c7c7-11ea-919f-a09ce73fe616.gif)

Each rebuild is a full bundle (both server-side and client-side) yet takes only <100ms.


## Install

```bash
yarn add maho
```

## Usage

This basic usage is very similar to [Next.js](https://nextjs.org).

You can create new project with `create-maho-app`.

```bash
# For npm
npx create-maho-app my-app

# For yarn
yarn create maho-app my-app

# For pnpm
pnpx create-maho-app my-app
```

## Roadmap

### Nested routes and dynamic routes

Work in Progress.

### Server-side data fetching

Work in Progress.

```tsx
export const load = async () => {
  const posts = await getPosts()
  return {
    posts
  }
}

export default () => {
  const { posts } = useData()

  return <div>
    {posts.map(post => <div key={post.id}>{post.title}</div>)}
  </div>
}
```

### Code splitting

🚧 upstream: esbuild: only work with esm format

### CSS support

🚧 upstream: esbuild

Though directly importing CSS in your JavaScript / TypeScript code is not yet supported, you can use CSS-in-JS solutions like [emotion](./examples/with-emotion) without any configuration, alternative you can have CSS in [`./public` folder](./examples/public-folder) and reference them using `<link>` tag in your components.

### Hot reloading

Currently it supports live reload.

## License

MIT &copy; [EGOIST (Kevin Titor)](https://github.com/sponsors/egoist)
