import { resolve, join } from 'path'
import polka from 'polka'
import glob from 'fast-glob'
import { outputFile, readFileSync } from 'fs-extra'
import { renderToString, renderToStaticMarkup } from 'react-dom/server'
import React from 'react'
import serveStatic from 'serve-static'
import Helmet from 'react-helmet'
import Document from './Document'
import { Service, startService, Loader } from 'esbuild'
import WebSocket from 'ws'
import { StaticRouter } from 'react-router-dom/server'
import { MahoContext } from './context'
import { getExternalDeps } from './external'

global.__node_require__ = require

const OWN_PKG = JSON.parse(
  readFileSync(join(__dirname, '../package.json'), 'utf-8'),
)

export type Options = {
  dir?: string
  dev?: boolean
}

class Maho {
  options: Required<Options>
  cacheDir: string
  serverEntryPath: string
  clientEntryPath: string
  serverService?: Service
  clientService?: Service
  buildId: string
  wss?: WebSocket.Server

  constructor(options: Options) {
    this.options = {
      ...options,
      dir: resolve(options.dir || '.'),
      dev: Boolean(options.dev),
    }

    this.cacheDir = join(this.options.dir, '.maho')
    this.serverEntryPath = join(this.cacheDir, 'templates/server-entry.jsx')
    this.clientEntryPath = join(this.cacheDir, 'templates/client-entry.jsx')
    // Naive implement of long-term cache
    this.buildId = `${Date.now()}`
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
      '.css': 'file'
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
        define: {
          ...commonDefine,
          'process.env.IS_SERVER': 'true',
        },
        external: [
          'maho',
          ...Object.keys(OWN_PKG.dependencies),
          ...getExternalDeps(this.options.dir),
        ],
      }),
      await this.serverService.build({
        platform: 'browser',
        format: 'cjs',
        bundle: true,
        loader,
        minify: !this.options.dev,
        entryPoints: [this.clientEntryPath],
        outdir: join(this.cacheDir, 'client'),
        sourcemap: this.options.dev,
        define: {
          ...commonDefine,
          'process.env.IS_SERVER': 'false',
        },
      }),
    ])

    const end = process.hrtime(start)
    const timeInMs = (end[0] * 1000000000 + end[1]) / 1000000
    console.log(`Bundle - success in ${Math.floor(timeInMs)}ms`)
  }

  async prepare() {
    const pagesDir = join(this.options.dir, 'pages')
    const pageGlobs = ['**/*.{ts,tsx,js,jsx}']
    const files = new Set(
      await glob(pageGlobs, {
        cwd: pagesDir,
      }),
    )

    const emitTemplates = async () => {
      const routes = [...files].map((file) => {
        const path = `/${file
          .replace(/\.[a-z]+$/, '')
          .replace(/^index$/, '')
          .replace(/\/index$/, '')}`
        return {
          path,
          absolute: join(pagesDir, file),
          relative: file,
          name: file.replace(/[^a-zA-Z0-9]/g, '_'),
        }
      })
      const routesContent = `
      import React from 'react'
      import { Routes as _Routes, Route } from 'react-router-dom'
      import { useMahoContext, MahoContext } from 'maho'

      ${routes
        .map((route) => {
          return `import Route_${route.name} from "${route.absolute}"`
        })
        .join('\n')}

      export const buildId = "${this.buildId}"

      const NotFound = () => {
        const context = useMahoContext()
        context.statusCode = 404
        return <div>404</div>
      }
    
      export const Routes = () => {
        return <_Routes>
          ${routes
            .map((route) => {
              return `<Route path="${route.path}">
                <Route_${route.name} />
              </Route>`
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

      export const App = ({ context, url, Router }) => {
        if (!process.env.IS_SERVER && process.env.NODE_ENV === 'development') {
          useLiveReload()
        }
        return <MahoContext.Provider value={context}>
          <Router location={process.env.IS_SERVER ? url : location.href}>
            <Routes />
          </Router>
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
      import { hydrate } from 'react-dom'
      import { BrowserRouter } from 'react-router-dom'
      import { App } from './routes'
  
      const state = window.INITIAL_STATE

      hydrate(<App 
        Router={BrowserRouter} 
        context={{ statusCode: state.statusCode }} />, document.getElementById('_maho'))
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
    }
  }

  async build() {
    await this.prepare()
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
      await this.prepare()
      await this.bundle()

      this.startWss()
    }

    const server = polka()

    server.use('/_maho', serveStatic(join(this.cacheDir, 'client')))
    server.use(serveStatic(join(this.options.dir, 'public')))

    server.get('*', (req: any, res: any) => {
      if (this.options.dev) {
        for (const file of Object.keys(require.cache)) {
          if (file.startsWith(this.cacheDir)) {
            delete require.cache[file]
          }
        }
      }
      const { App, buildId } = require(join(
        this.cacheDir,
        'server/routes.js',
      ))
      const context: any = { url: req.url, statusCode: 200 }
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
        <script>INITIAL_STATE = {`{
          statusCode: ${context.statusCode}
        }`}</script>
        <script src={`/_maho/client-entry.js?t=${buildId}`} />
        </>
      )
      const html = renderToStaticMarkup(
        <MahoContext.Provider value={context}>
          <Document Main={Main} Scripts={Scripts} />
        </MahoContext.Provider>,
      )
      res.statusCode = context.statusCode
      res.end(`<!DOCTYPE html>${html}`)
    })

    server.listen(3000)
    console.log(`Ready  - http://localhost:3000`)
  }
}

export const maho = (options: Options) => new Maho(options)
