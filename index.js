#!/usr/bin/env node

const path = require('path')
const homedir = require('os').homedir()
const fs = require('fs')
const http = require('http')

const ansiStyles = require('ansi-styles')
const yaml = require('js-yaml')
const opn = require('opn')
const getPort = require('get-port')

const ERR_ARROWS = `${ansiStyles.red.open}>>${ansiStyles.red.close}`
const KUBESAIL_WWW_HOST = 'https://kubesail.com'
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

htmlResponse = `<!DOCTYPE html>
<html>
  <head>
    <title>Kubesail Config Complete</title>
    <link href="https://fonts.googleapis.com/css?family=IBM+Plex+Sans" rel="stylesheet">
    <style>
      html {
        height: 100%;
      }
      body {
        color: #131518;
        font-family: 'IBM Plex Sans', sans-serif;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        height:100%;
      }
      svg {
        height: 5rem;
      }
      h2 {
        font-weight: normal;
        text-transform: uppercase;
        font-size: 2.2rem;
      }
      p {
        margin-top: 3rem;
      }
    </style>
  </head>
  <body>
    <h2>Kubesail is now configured</h2>
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512">
      <path fill="currentColor" d="M257.981 272.971L63.638 467.314c-9.373 9.373-24.569 9.373-33.941 0L7.029 444.647c-9.357-9.357-9.375-24.522-.04-33.901L161.011 256 6.99 101.255c-9.335-9.379-9.317-24.544.04-33.901l22.667-22.667c9.373-9.373 24.569-9.373 33.941 0L257.981 239.03c9.373 9.372 9.373 24.568 0 33.941zM640 456v-32c0-13.255-10.745-24-24-24H312c-13.255 0-24 10.745-24 24v32c0 13.255 10.745 24 24 24h304c13.255 0 24-10.745 24-24z"/>
    </svg>
    <p>You can close this window and return to your terminal</p>
  </body>
</html>
`

if (fs.existsSync(KUBE_CONFIG_PATH)) {
  try {
    config = yaml.safeLoad(fs.readFileSync(KUBE_CONFIG_PATH))
  } catch (err) {
    fatal(
      `It seems you have a Kubernetes config file at ${KUBE_CONFIG_PATH}, but it is not valid yaml, or unreadable!`
    )
  }
}

if (!fs.existsSync(path.join(homedir, '.kube'))) {
  try {
    fs.mkdirSync(path.join(homedir, '.kube'))
  } catch (err) {
    fatal('Error creating a .kube folder in your home directory. You can try manually creating it.')
  }
}

const kubesailContexts = config.contexts
  .map(
    context =>
      context.name || ((context.context && context.context.name) || context.context.cluster)
  )
  .filter(context => context.includes('kubesail-'))

function parseUrlParams(url) {
  const query = url.split('?')[1] || ''
  const result = {}
  query.split('&').forEach(function(part) {
    const item = part.split('=')
    result[item[0]] = decodeURIComponent(item[1])
  })
  return result
}

async function getKubesailConfig() {
  if (kubesailContexts.length > 0) {
    process.stdout.write('  You already have a Kubesail context. Attempting to update.\n')
  }

  const port = await getPort()
  return new Promise(function(resolve, reject) {
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

        // Append or replace cluster config
        const cluster = {
          name: `kubesail-${data.username}`,
          cluster: {
            'certificate-authority-data': data.cert,
            server: data.clusterAddress
          }
        }
        const clusterIndex = config.clusters.map(({ name }) => name).indexOf(cluster.name)
        if (clusterIndex > -1) {
          config.clusters[clusterIndex]
        } else {
          config.clusters.push(cluster)
        }

        // Append or replace user config
        const user = {
          name: `kubesail-${data.username}`,
          user: {
            'client-key-data': data.cert,
            token: data.token
          }
        }
        const userIndex = config.users.map(({ name }) => name).indexOf(user.name)
        if (userIndex > -1) {
          config.users[userIndex]
        } else {
          config.users.push(user)
        }

        // Append or replace user config
        const context = {
          name: `kubesail-${data.username}`,
          context: {
            cluster: `kubesail-${data.username}`,
            namespace: data.namespace,
            user: `kubesail-${data.username}`
          }
        }
        const contextIndex = config.contexts.map(({ name }) => name).indexOf(context.name)
        if (contextIndex > -1) {
          config.contexts[contextIndex]
        } else {
          config.contexts.push(context)
        }

        //TODO prompt to update if its already set?
        if (config['current-context'] === null) {
          config['current-context'] = `kubesail-${data.username}`
        }

        fs.writeFileSync(KUBE_CONFIG_PATH, yaml.safeDump(config))

        res.setHeader('Content-Type', 'text/html')
        res.write(htmlResponse)
        res.end()

        process.stderr.write(
          `  Added Kubesail config to ${ansiStyles.gray.open}${KUBE_CONFIG_PATH}\n${
            ansiStyles.gray.close
          }`
        )
        resolve(context.name)
        server.close(() => {
          if (require.main === module) {
            process.exit(0)
          }
        })
      })
      .listen(port, () => {
        opn(`${KUBESAIL_WWW_HOST}/register?listenPort=${port}`)
      })
  })
}

module.exports = getKubesailConfig

if (require.main === module) {
  getKubesailConfig()
}
