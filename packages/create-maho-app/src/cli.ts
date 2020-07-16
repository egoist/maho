#!/usr/bin/env node
import { join } from 'path'
import { majo } from 'majo'

const outDir = process.argv.slice(2)[0]

if (!outDir) {
  console.error(
    `Please specify an output directory, we can't output to current directory`,
  )
  process.exit(1)
}

const stream = majo()

stream.source(['**/*'], {
  baseDir: join(__dirname, '../template'),
})

stream.dest(outDir).then(() => {
  console.log(`
  Success!

  Now \`cd ${outDir}\` and run \`yarn dev\` or \`npm run dev\` 
  `)
}).catch((error) => {
  console.error(error)
  process.exit(1)
})
