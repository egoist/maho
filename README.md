# Maho

A framework for building server-rendered or static websites, powered by React and [esbuild](https://github.com/evanw/esbuild).

This framework is not production-ready yet, since esbuild itself is not mature enough, (but [evanw](https://github.com/evanw) is working on that).

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

### Code spltting

🚧 upstream: esbuild: only work with esm format

### CSS support

🚧 upstream: esbuild

### Hot reloading

Currently it supports live reload.

## License

MIT &copy; [EGOIST (Kevin Titor)](https://github.com/sponsors/egoist)
