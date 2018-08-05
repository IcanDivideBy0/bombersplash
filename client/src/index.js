import React from "react";
import ReactDOM from "react-dom";

import { SocketProvider } from "modules/net";

import "./index.css";
import { App } from "modules/app";

ReactDOM.render(
  <SocketProvider socketUrl={process.env.REACT_APP_GAME_HOST}>
    <App />
  </SocketProvider>,
  document.getElementById("root")
);
