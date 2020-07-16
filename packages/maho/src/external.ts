import JoyCon from 'joycon'

const joycon = new JoyCon()

export const getExternalDeps = (cwd: string) => {
  const { data } = joycon.loadSync(['package.json'], cwd)
  return Object.keys(data?.dependencies || {})
}
