# get-kubesail-config

A utility to help register for an account and download a Kubernetes config from [KubeSail.com](https://kubesail.com)

Can be run standalone or within another package. Currently used by [deploy-to-kube](https://github.com/kubesail/deploy-to-kube)

### Prerequisites

- Node - ([npx](https://medium.com/@maybekatz/introducing-npx-an-npm-package-runner-55f7d4bd282b) comes with npm 5.2+ and higher)
- [kubectl](https://kubernetes.io/docs/tasks/tools/install-kubectl/) (optional) - useful for managing deployments after running this utility

### Running

Just run `npx get-kubesail-config`. You can then manage your deployments and other resoureces using kubectl.

### About

[KubeSail](https://kubesail.com) is simple Kubernetes provider that makes it easy to get started with Kubernetes for free.
