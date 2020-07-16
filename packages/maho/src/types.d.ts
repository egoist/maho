declare module 'polka'

namespace NodeJS {
  interface Global {
    __node_require__: any
  }
}
