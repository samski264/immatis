// PM2 de l'utilisateur samy. Ne pas lancer dans le PM2 de root :
// celui-ci fait déjà tourner standard_api sur le port 9001.
module.exports = {
  apps: [
    {
      name: "immatis-api",
      script: "server.js",
      node_args: "--env-file=.env",
      env: {
        PORT: "3010",
        HOST: "127.0.0.1",
      },
    },
  ],
}
