## Starter Streamlit app with easy deployment to AWS

Streamlit is a great tool to build machine learning demo. This repo contains a scaffold of a 
Streamlit app with support for deploying the app to AWS' ECS, using an existing domain name.

### Prerequisites

- Docker.
- NodeJS. We recommend using `nvm`.
- A domain name already set up via AWS Route53's Hosted zones.

### Getting Started

Build and run the docker image.

```shell
docker build -t stapp .
docker run -p 8501:8501 -d stapp
```

Now, open the streamlit app: `http://localhost:8501.`

### Manual Deployment to AWS ECS

Make sure you have Pulumi install and make the changes in the config file [`Pulumi.dev.yaml,`](./deploy/Pulumi.dev.yaml)
in particular change the domain name.

```
cd deploy
pulumi up -s dev
```

### Continuous Deployment with GitHub Actions

Deployment is automatically kicked off when there's a push to `main.`
See [this config file](./.github/workflows/push.yml).