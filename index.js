const path = require('path')
const homedir = require('os').homedir()
const fs = require('fs')
const http = require('http')

const ansiStyles = require('ansi-styles')
const yaml = require('js-yaml')
const opn = require('opn')
const getPort = require('get-port')

const ERR_ARROWS = `${ansiStyles.red.open}>>${ansiStyles.red.close}`
const KUBESAIL_WWW_HOST = 'https://localhost:3000'
const KUBE_CONFIG_PATH = path.join(homedir, '.kube', 'config')

function fatal(message /*: string */) {
  process.stderr.write(`${ERR_ARROWS} ${message}\n`)
  process.exit(1)
}

let config = {
  kind: 'Config',
  apiVersion: 'v1',
  preferences: {},

  'current-context': null,
  clusters: [],
  contexts: [],
  users: []
}
if (fs.existsSync(KUBE_CONFIG_PATH)) {
  try {
    config = yaml.safeLoad(fs.readFileSync(KUBE_CONFIG_PATH))
  } catch (err) {
    fatal(
      `It seems you have a Kubernetes config file at ${KUBE_CONFIG_PATH}, but it is not valid yaml, or unreadable!`
    )
  }
}

const kubesailContexts = config.contexts
  .map(
    context =>
      context.name || ((context.context && context.context.name) || context.context.cluster)
  )
  .filter(context => context.includes('kubesail'))

if (kubesailContexts.length > 0) {
  process.stdout.write(
    'You already have a kubesail context. Attempting to update if they are the same name'
  )
}

function parseUrlParams(url) {
  const query = url.split('?')[1] || ''
  const result = {}
  query.split('&').forEach(function(part) {
    const item = part.split('=')
    result[item[0]] = decodeURIComponent(item[1])
  })
  return result
}

async function connectKubeSail() {
  const port = await getPort()
  const server = http
    .createServer(function(req, res) {
      let { data } = parseUrlParams(req.url)
      try {
        data = JSON.parse(data)
      } catch (err) {
        res.write('error parsing data')
        res.end()
        return
      }

      if (!data || !data.clusterAddress || !data.token || !data.namespace || !data.username) {
        res.write('Kube config is missing data')
        res.end()
        return
      }

      config.clusters.push({
        name: `kubesail-${data.username}`,
        cluster: {
          'certificate-authority-data': data.cert,
          server: data.clusterAddress
        }
      })

      config.users.push({
        name: `kubesail-${data.username}`,
        user: {
          'client-key-data': data.cert,
          token: data.token
        }
      })

      config.contexts.push({
        name: `kubesail-${data.username}`,
        context: {
          cluster: `kubesail-${data.username}`,
          namespace: data.namespace,
          user: `kubesail-${data.username}`
        }
      })

      //TODO prompt to update if its already set?
      if (config['current-context'] === null) {
        config['current-context'] = `kubesail-${data.username}`
      }

      fs.writeFileSync(KUBE_CONFIG_PATH, yaml.safeDump(config))

      res.write('Kube configured locally, you may return to terminal!')
      res.end()
      server.close(() => {
        console.log('callback server closed, exiting successfully...')
        process.exit(0)
      })
    })
    .listen(port, () => {
      opn(`${KUBESAIL_WWW_HOST}/register?listenPort=${port}`).then(cp => console.log({ cp }))
    })
}
connectKubeSail()
