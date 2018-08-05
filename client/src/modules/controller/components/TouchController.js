import React from "react";
import styled from "styled-components";

import Stick from "./Stick";

const TouchControllerStick = styled(Stick)`
  display: none;
  position: absolute;
  bottom: 2vw;
  left: 2vw;

  @media (hover: none) {
    display: block;
  }
`;

const BombButton = styled.button`
  display: none;
  position: absolute;
  bottom: 7vw;
  right: 7vw;
  width: 10vw;
  height: 10vw;

  @media (hover: none) {
    display: block;
  }
`;

export default class TouchController extends React.PureComponent {
  state = {
    inputs: {}
  };

  handleInputVelChange = vel => {
    const { inputs, onInputChange } = this.props;
    onInputChange({ ...inputs, vel });
  };

  handleBombTouch = pressed => {
    const { inputs, onInputChange } = this.props;

    onInputChange({
      ...inputs,
      actions: { ...inputs.actions, placeBomb: pressed }
    });
  };

  render() {
    const { inputs } = this.props;

    return (
      <React.Fragment>
        <TouchControllerStick
          value={inputs.vel}
          onChange={this.handleInputVelChange}
        />

        <BombButton
          onTouchStart={() => this.handleBombTouch(true)}
          onTouchEnd={() => this.handleBombTouch(false)}
        />
      </React.Fragment>
    );
  }
}
