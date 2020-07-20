import { resolve, join, relative } from 'path'
import polka from 'polka'
import glob from 'fast-glob'
import { outputFile, readFileSync, remove, existsSync } from 'fs-extra'
import { renderToString, renderToStaticMarkup } from 'react-dom/server'
import React from 'react'
import serveStatic from 'serve-static'
import Helmet from 'react-helmet'
import devalue from 'devalue'
import Document from './Document'
import { Service, startService, Loader } from 'esbuild'
import WebSocket from 'ws'
import type { SetRequired } from 'type-fest'
import { StaticRouter } from 'react-router-dom/server'
import { MahoContext } from './context'
import { getExternalDeps } from './external'
import {
  matchRoutes,
  createRoutesFromArray,
  generatePath,
} from 'react-router-dom'
import { LoadFunction } from '../dist'

const OWN_PKG = JSON.parse(
  readFileSync(join(__dirname, '../package.json'), 'utf-8'),
)

import sourceMapSupport from 'source-map-support'

sourceMapSupport.install()

export type Options = {
  dir?: string
  dev?: boolean
  /**
   * Watch additional resources
   * Can be one or more glob patterns
   */
  watch?: string | string[]
  /**
   * Output ES module
   * Also enables code splitting
   */
  esm?: boolean
}

class Maho {
  options: SetRequired<Options, 'dir' | 'dev'>
  cacheDir: string
  srcDir: string
  serverEntryPath: string
  clientEntryPath: string
  serverService?: Service
  clientService?: Service
  buildId: string
  wss?: WebSocket.Server
  routes: Array<{
    path: string
    absolute: string
    relative: string
    name: string
  }>

  constructor(options: Options) {
    this.options = {
      ...options,
      dir: resolve(options.dir || '.'),
      dev: Boolean(options.dev),
    }

    this.srcDir = existsSync(join(this.options.dir, 'src/pages'))
      ? join(this.options.dir, 'src')
      : this.options.dir
    this.cacheDir = join(this.options.dir, '.maho')
    this.serverEntryPath = join(this.cacheDir, 'templates/server-entry.jsx')
    this.clientEntryPath = join(this.cacheDir, 'templates/client-entry.jsx')
    // Naive implement of long-term cache
    this.buildId = `${Date.now()}`

    this.routes = []
  }

  async bundle() {
    const start = process.hrtime()
    console.log(`Bundle - start`)
    if (!this.serverService) {
      this.serverService = await startService()
    }
    if (!this.clientService) {
      this.clientService = await startService()
    }
    const commonDefine = {
      'process.env.NODE_ENV': JSON.stringify(
        this.options.dev ? 'development' : 'production',
      ),
    }
    const loader: {
      [ext: string]: Loader
    } = {
      '.svg': 'file',
      '.jpg': 'file',
      '.png': 'file',
      '.gif': 'file',
      '.css': 'file',
    }
    await Promise.all([
      await this.serverService.build({
        platform: 'node',
        format: 'cjs',
        bundle: true,
        loader,
        minify: !this.options.dev,
        entryPoints: [join(this.cacheDir, 'templates/routes.jsx')],
        outdir: join(this.cacheDir, 'server'),
        sourcemap: this.options.dev,
        define: {
          ...commonDefine,
          'process.browser': 'false',
        },
        external: [
          'maho',
          ...Object.keys(OWN_PKG.dependencies),
          ...getExternalDeps(this.options.dir),
        ],
      }),
      await this.serverService.build({
        platform: 'browser',
        format: this.options.esm ? 'esm' : 'cjs',
        splitting: this.options.esm,
        bundle: true,
        loader,
        minify: !this.options.dev,
        entryPoints: [this.clientEntryPath],
        outdir: join(this.cacheDir, 'client'),
        sourcemap: this.options.dev,
        metafile: join(this.cacheDir, 'metafile.json'),
        define: {
          ...commonDefine,
          'process.browser': 'true',
        },
      }),
    ])

    const end = process.hrtime(start)
    const timeInMs = (end[0] * 1000000000 + end[1]) / 1000000
    console.log(`Bundle - success in ${Math.floor(timeInMs)}ms`)
  }

  get meta(): { esm?: boolean } {
    return require(join(this.cacheDir, 'meta.json'))
  }

  async prepare(type: 'dev-server' | 'build' | 'prod-server') {
    if (type === 'prod-server') {
      this.options.esm = this.meta.esm
      return
    }

    await remove(join(this.cacheDir, 'client'))

    await outputFile(
      join(this.cacheDir, 'meta.json'),
      JSON.stringify({
        esm: this.options.esm,
      }),
      'utf8',
    )

    const pagesDir = join(this.srcDir, 'pages')
    const pageGlobs = ['**/*.{ts,tsx,js,jsx}']
    const files = new Set(
      await glob(pageGlobs, {
        cwd: pagesDir,
      }),
    )

    const toRelative = (absolute: string) =>
      `./${relative(join(this.cacheDir, 'templates'), absolute)}`

    const emitTemplates = async () => {
      const routes = (this.routes = [...files].map((file) => {
        const path = `/${file
          .replace(/\.[a-z]+$/, '')
          .replace(/^index$/, '')
          .replace(/\/index$/, '')
          .replace(/\[\.\.\.([^\]]+)\]/g, '*')
          .replace(/\[([^\]]+)\]/g, ':$1')}`
        return {
          path,
          absolute: join(pagesDir, file),
          relative: file,
          name: file.replace(/[^a-zA-Z0-9]/g, '_'),
        }
      }))
      const routesContent = `
      import React from 'react'
      import { Routes as _Routes, Route, useLocation } from 'react-router-dom'
      import { useMahoContext, MahoContext } from 'maho'

      const Suspense = process.browser ? React.Suspense : ({children}) => children

      ${routes
        .map((route) => {
          return `
          let Route_${route.name}
          let load_${route.name}
          if (process.browser && ${this.options.esm}) {
            Route_${route.name} = React.lazy(() => import("${toRelative(
            route.absolute,
          )}"))
          } else {
            const res = require("${toRelative(route.absolute)}")
            Route_${route.name} = res.default
            load_${route.name} = res.load
          }
          `
        })
        .join('\n')}

      export const buildId = "${this.buildId}"

      const NotFound = () => {
        const context = useMahoContext()
        context.statusCode = 404
        return <div>404</div>
      }

      export const loadFunctions = process.browser ? undefined : [
        ${routes
          .map((route) => {
            return `{
            path: "${route.path}",
            load: load_${route.name}
          }`
          })
          .join(',\n')}
      ]
    
      export const Routes = () => {
        if (process.browser) {
          const location = useLocation()
          React.useEffect(() => {
            const state = window.INITIAL_STATE
            state.revalidateOnMount = true
          }, [location.pathname])
        }
        return <_Routes>
          ${routes
            .map((route) => {
              return `<Route path="${route.path}"
                element={<Route_${route.name} />}
              />`
            })
            .join('\n')}
          <Route path="*" element={<NotFound />} />
        </_Routes>
      }

      const useLiveReload = () => {
        React.useEffect(() => {
          let ws = new WebSocket(\`ws://\${location.hostname}:8080\`)
          ws.onerror = () => {
            console.error('WebSocket error')
          }
          ws.onopen = () => {
            console.log('WebSocket connection established')
          }
          ws.onclose = () => {
            console.log('WebSocket connection closed')
            ws = null
          }
          ws.onmessage = (e) => {
            if (e.data === 'reload') {
              location.reload()
            }
          }
        }, [])
      }

      class ErrorBoundary extends React.Component {
        state = {error: null}
        static getDerivedStateFromError(error) {
          return {error}
        }
        componentDidCatch() {
          // log the error to the server
        }
        tryAgain = () => this.setState({error: null})
        render() {
          return this.state.error ? (
            <div>
              There was an error. <button onClick={this.tryAgain}>try again</button>
              <pre style={{whiteSpace: 'normal'}}>{this.state.error.message}</pre>
            </div>
          ) : (
            this.props.children
          )
        }
      }

      export const App = ({ context, Router }) => {
        if (process.browser && process.env.NODE_ENV === 'development') {
          useLiveReload()
        }
        return <MahoContext.Provider value={context}>
          <ErrorBoundary>
            <Suspense fallback={<div>Loading...</div>}>
              <Router location={context.url}>
                <Routes />
              </Router>
            </Suspense>
          </ErrorBoundary>
        </MahoContext.Provider>
      }
      `

      await outputFile(
        join(this.cacheDir, 'templates/routes.jsx'),
        routesContent,
        'utf8',
      )

      const clientEntryContent = `
      import React from 'react'
      import ReactDOM from 'react-dom'
      import { BrowserRouter } from 'react-router-dom'
      import { App } from './routes'
  
      const state = window.INITIAL_STATE

      ReactDOM.unstable_createRoot(document.getElementById('_maho'))
        .render(<App 
          Router={BrowserRouter}
          context={{ statusCode: state.statusCode, url: location.href, routeData: state.routeData }} />)
      `
      await outputFile(this.clientEntryPath, clientEntryContent, 'utf8')
    }

    await emitTemplates()

    if (this.options.dev) {
      const reload = () => {
        if (this.wss?.clients) {
          for (const client of this.wss.clients) {
            client.send('reload')
          }
        }
      }

      const { watch } = await import('chokidar')
      watch(pageGlobs, {
        ignoreInitial: true,
        cwd: pagesDir,
      })
        .on('add', async (file) => {
          files.add(file)
          await emitTemplates()
          await this.bundle()
          reload()
        })
        .on('change', async (file) => {
          await this.bundle()
          reload()
        })
        .on('unlink', async (file) => {
          files.delete(file)
          await emitTemplates()
          await this.bundle()
          reload()
        })

      if (this.options.watch) {
        watch(this.options.watch, {
          ignoreInitial: true,
          cwd: this.srcDir,
          ignored: [
            join(pagesDir, '**/*'),
            '!**/node_modules**/',
            '!**/.maho/**',
            '!**/out/**',
          ],
        }).on('all', async () => {
          await this.bundle()
          reload()
        })
      }
    }
  }

  async build() {
    await this.prepare('build')
    await this.bundle()
    if (this.serverService) {
      this.serverService.stop()
      this.serverService = undefined
    }
    if (this.clientService) {
      this.clientService.stop()
      this.clientService = undefined
    }
  }

  startWss() {
    this.wss = new WebSocket.Server({
      port: 8080,
      perMessageDeflate: {
        zlibDeflateOptions: {
          // See zlib defaults.
          chunkSize: 1024,
          memLevel: 7,
          level: 3,
        },
        zlibInflateOptions: {
          chunkSize: 10 * 1024,
        },
        // Other options settable:
        clientNoContextTakeover: true, // Defaults to negotiated value.
        serverNoContextTakeover: true, // Defaults to negotiated value.
        serverMaxWindowBits: 10, // Defaults to negotiated value.
        // Below options specified as default values.
        concurrencyLimit: 10, // Limits zlib concurrency for perf.
        threshold: 1024, // Size (in bytes) below which messages
        // should not be compressed.
      },
    })
  }

  async startServer() {
    if (this.options.dev) {
      await this.prepare('dev-server')
      await this.bundle()

      this.startWss()
    } else {
      await this.prepare('prod-server')
    }

    const server = polka()

    server.use(serveStatic(join(this.cacheDir, 'client')))
    server.use(serveStatic(join(this.srcDir, 'public')))
    const handleRequestError = (fn: any) => async (req: any, res: any) => {
      try {
        await fn(req, res)
      } catch (error) {
        console.error(error)
        res.statusCode = 500
        res.end(this.options.dev ? error.stack : 'server error')
      }
    }

    server.get(
      '*',
      handleRequestError(async (req: any, res: any) => {
        if (this.options.dev) {
          for (const file of Object.keys(require.cache)) {
            if (file.startsWith(this.cacheDir)) {
              delete require.cache[file]
            }
          }
        }
        const { App, buildId, loadFunctions } = require(join(
          this.cacheDir,
          'server/routes.js',
        )) as {
          App: any
          buildId: string
          loadFunctions: Array<{
            path: string
            load: LoadFunction
          }>
        }
        const routes = createRoutesFromArray(
          this.routes.map((r) => ({ path: r.path })),
        )
        const routeMatches = matchRoutes(routes, req.url)
        const routeData: { [path: string]: any } = {}

        if (routeMatches) {
          const { load } =
            loadFunctions.find(
              (item) => item.path === routeMatches[0].route.path,
            ) || {}
          if (load) {
            const p = generatePath(
              routeMatches[0].route.path,
              routeMatches[0].params,
            )
            routeData[p] = await load({
              params: routeMatches[0].params,
            })
          }
        }
        if (req.headers.accept === 'application/json') {
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify(routeData))
          return
        }
        const context: any = { url: req.url, statusCode: 200, routeData }
        const main = renderToString(
          <App Router={StaticRouter} context={context} />,
        )
        const helmet = Helmet.renderStatic()
        context.helmet = helmet
        const Main = () => (
          <div id="_maho" dangerouslySetInnerHTML={{ __html: main }}></div>
        )
        const Scripts = () => (
          <>
            <script
              dangerouslySetInnerHTML={{
                __html: `INITIAL_STATE=${devalue({
                  statusCode: context.statusCode,
                  routeData: context.routeData,
                })}`,
              }}
            ></script>
            <script
              type={this.options.esm ? 'module' : undefined}
              src={
                this.options.esm
                  ? `/.maho/templates/client-entry.js?t=${buildId}`
                  : `/client-entry.js?t=${buildId}`
              }
            />
          </>
        )
        const html = renderToStaticMarkup(
          <MahoContext.Provider value={context}>
            <Document Main={Main} Scripts={Scripts} />
          </MahoContext.Provider>,
        )
        res.statusCode = context.statusCode
        res.end(`<!DOCTYPE html>${html}`)
      }),
    )

    server.listen(3000)
    console.log(`Ready  - http://localhost:3000`)
  }
}

export const maho = (options: Options) => new Maho(options)
