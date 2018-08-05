import React from "react";

const anyPressed = pressedKeys => keys => {
  for (const key of Array.isArray(keys) ? keys : [keys]) {
    if (~pressedKeys.indexOf(key)) return true;
  }

  return false;
};

export default class KeyboardController extends React.PureComponent {
  pressedKeys = [];

  componentDidMount() {
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
  }

  componentWillUnmount() {
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
  }

  handleKeyDown = event => {
    const keys = [
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "z",
      "q",
      "s",
      "d",
      " "
    ];
    if (~keys.indexOf(event.key)) event.preventDefault();

    const index = this.pressedKeys.indexOf(event.key);
    if (~index) return;

    this.pressedKeys.push(event.key);
    this.handleChange();
  };

  handleKeyUp = event => {
    const index = this.pressedKeys.indexOf(event.key);
    if (~index) this.pressedKeys.splice(index, 1);
    this.handleChange();
  };

  handleChange() {
    const { onInputChange } = this.props;
    let vel = { x: 0, y: 0 };

    /**
     * Movement
     */

    const testKeys = anyPressed(this.pressedKeys);

    if (testKeys(["ArrowUp", "z"])) vel.y -= 1;
    if (testKeys(["ArrowDown", "s"])) vel.y += 1;
    if (testKeys(["ArrowLeft", "q"])) vel.x -= 1;
    if (testKeys(["ArrowRight", "d"])) vel.x += 1;

    const hypot = Math.hypot(vel.x, vel.y);

    vel = {
      x: hypot < 1 ? vel.x : vel.x / hypot,
      y: hypot < 1 ? vel.y : vel.y / hypot
    };

    /**
     * Actions
     */

    const actions = {
      placeBomb: false
    };

    if (testKeys([" "])) actions.placeBomb = true;

    /**
     *
     */

    onInputChange({ vel, actions });
  }

  render() {
    return null;
  }
}
