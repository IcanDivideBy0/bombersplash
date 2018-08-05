const path = require("path");
const express = require("express");
const app = express();
const http = require("http").Server(app);
const io = require("socket.io")(http);
const myIp = require("my-ip");
const chalk = require("chalk");
const cors = require("cors");
const bodyParser = require("body-parser");

const gameMiddleware = require("./game-middleware");

/**
 * Expose application.
 */

app.enable("trust proxy");
app.use(cors());

app.use(
  express.static(path.resolve(__dirname, "..", "public"), {
    extensions: ["html", "json"]
  })
);

app.use(bodyParser.json());

app.get("/", (req, res) => {
  res.send("Hello world!");
});

app.use(gameMiddleware(io));

const port = process.env.PORT || 3333;
http.listen(port, () => {
  console.log(chalk.rgb(10, 100, 200)(`Web server started:`));
  console.log(chalk`{bold Local:}            http://localhost:{bold ${port}}`);
  console.log(chalk`{bold On Your Network:}  http://${myIp()}:{bold ${port}}`);
});
