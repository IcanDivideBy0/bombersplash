import React from "react";

import { GamePage } from "modules/game";

import FullscreenButton from "./FullscreenButton";

export default class App extends React.Component {
  state = {
    gameCount: 0
  };

  handleNewGame = () => {
    this.setState({ gameCount: this.state.gameCount + 1 });
  };

  render() {
    const { gameCount } = this.state;

    return (
      <React.Fragment>
        <GamePage key={gameCount} onNewGame={this.handleNewGame} />

        <FullscreenButton />
      </React.Fragment>
    );
  }
}
