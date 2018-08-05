import React from "react";
import styled from "styled-components";
import throttle from "lodash.throttle";

import { compose } from "modules/utils";
import { withSocket } from "modules/net";
import { KeyboardController, TouchController } from "modules/controller";

import Game from "../Game";
import GameCanvas from "./GameCanvas";
import Scores from "./Scores";

const ErrorWrapper = styled.div`
  position: fixed;
  left: 0;
  top: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
`;

const Loader = styled.div`
  position: fixed;
  left: 0;
  top: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
`;

const PlayersCounter = styled.div`
  position: fixed;
  top: 2rem;
  width: 100%;
  text-align: center;
  pointer-events: none;

  & .number {
    color: #aa3333;
  }
`;

const ResultsWrapper = styled.div`
  position: fixed;
  width: 100vw;
  height: 100vh;
  background-color: #1c1117;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const Results = styled.div`
  text-align: center;
  display: grid;
  grid-gap: 16px;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);

  .text {
    grid-area: 1 / 2 / span 1 / span 1;
  }

  .team-green {
    grid-area: 2 / 1 / span 1 / span 1;
    padding-top: 16px;
    text-align: right;
  }

  .results {
    grid-area: 2 / 2 / span 1 / span 1;
  }

  .team-blue {
    grid-area: 2 / 3 / span 1 / span 1;
    padding-top: 16px;
    text-align: left;
  }

  .new-game {
    grid-area: 3 / 2 / span 1 / span 1;
    margin-top: 32px;
  }
`;

const NewGameButton = styled.button`
  color: #fff;
  background-color: #1c1117;
  border: 3px solid #fff;
  border-radius: 2px;
  padding: 0.2em 1em;
  cursor: pointer;
  text-transform: uppercase;
  padding: 16px;
  outline: none;
  transition: border-color 0.2s linear;

  &:hover,
  &:focus {
    border: 3px solid #aa3333;
  }
`;

class GamePage extends React.Component {
  state = {
    inputs: {
      vel: { x: 0, y: 0 },
      actions: {}
    },
    ready: false,
    error: null,
    gameState: null,
    showResults: false
  };

  async componentDidMount() {
    const { socket } = this.props;

    this.mounted = true;

    this.game = new Game(socket);
    this.game.on(
      "update",
      throttle((...args) => {
        if (!this.mounted) return;
        if (!this.state.ready || this.state.error)
          this.setState({ ready: true, error: null });

        this.handleGameUpdate(...args);
      }, 5000)
    );
    this.game.once("end", this.handleGameEnd);

    try {
      await this.game.join();
      this.setState({ ready: true });
    } catch (error) {
      this.setState({ error });
    }
  }

  componentWillUnmount() {
    this.mounted = false;
  }

  handleGameUpdate = gameState => {
    this.setState({ gameState });
  };

  handleGameEnd = results => {
    this.setState({ showResults: true, results });

    this.game.destroy();
  };

  handleInputChange = inputs => {
    this.setState({ inputs });
    this.game.setInputs(inputs);
  };

  render() {
    const { onNewGame } = this.props;
    const {
      inputs,
      ready,
      error,
      gameState,
      showResults,
      results
    } = this.state;

    if (error) return <ErrorWrapper>{error.toString()}</ErrorWrapper>;
    if (!ready) return <Loader>Loading…</Loader>;

    return (
      <React.Fragment>
        <GameCanvas game={this.game} />

        <KeyboardController
          onInputChange={this.handleInputChange}
          inputs={inputs}
        />
        <TouchController
          onInputChange={this.handleInputChange}
          inputs={inputs}
        />

        {gameState && (
          <React.Fragment>
            <PlayersCounter className="GamePage-playersCount">
              Currently{" "}
              <span className="number">{gameState.players.length}</span>{" "}
              {gameState.players.length > 1 ? "players" : "player"}
            </PlayersCounter>

            <Scores
              scores={gameState.scores}
              style={{
                position: "fixed",
                bottom: "2rem",
                left: "50%",
                transform: "translateX(-50%)"
              }}
            />
          </React.Fragment>
        )}

        {showResults && (
          <ResultsWrapper>
            <Results>
              <div className="text">
                {results.blue === results.green && <h1>DRAW</h1>}
                {results.blue > results.green && <h1>BLUE TEAM WIN!</h1>}
                {results.blue < results.green && <h1>GREEN TEAM WIN!</h1>}
              </div>

              <div className="team-green">
                <img src={require("./images/green-player.png")} alt="" />
              </div>
              <Scores scores={results} className="results" />
              <div className="team-blue">
                <img src={require("./images/blue-player.png")} alt="" />
              </div>

              <div className="new-game">
                <NewGameButton onClick={onNewGame}>
                  Launch a new game!
                </NewGameButton>
              </div>
            </Results>
          </ResultsWrapper>
        )}
      </React.Fragment>
    );
  }
}

export default compose(withSocket())(GamePage);
