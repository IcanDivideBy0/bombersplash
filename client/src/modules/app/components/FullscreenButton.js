import React from "react";
import styled from "styled-components";

function requestFullscreen() {
  const docEl = document.documentElement;

  if (docEl.requestFullscreen) {
    docEl.requestFullscreen();
  } else if (docEl.mozRequestFullScreen) {
    docEl.mozRequestFullScreen();
  } else if (docEl.webkitRequestFullscreen) {
    docEl.webkitRequestFullscreen();
  } else if (docEl.msRequestFullscreen) {
    docEl.msRequestFullscreen();
  }
}

function exitFullscreen() {
  if (document.exitFullscreen) {
    document.exitFullscreen();
  } else if (document.mozExitFullScreen) {
    document.mozExitFullScreen();
  } else if (document.webkitExitFullscreen) {
    document.webkitExitFullscreen();
  } else if (document.msExitFullscreen) {
    document.msRequestFullscreen();
  }
}

function getFullscreenElement() {
  return (
    document.fullscreenElement ||
    document.mozFullScreenElement ||
    document.webkitFullscreenElement ||
    document.msFullscreenElement
  );
}

const Button = styled.button`
  position: fixed;
  top: 8px;
  right: 8px;
  background: none;
  border: none;
  outline: none;
  cursor: pointer;

  & svg {
    fill: #fff;
  }
`;

export default class FullscreenButton extends React.Component {
  state = {
    isFullscreen: !!getFullscreenElement()
  };

  handleToggleFullscreen = () => {
    const isFullscreen = !!getFullscreenElement();
    isFullscreen ? exitFullscreen() : requestFullscreen();

    this.setState({ isFullscreen: !isFullscreen });
  };

  render() {
    const { isFullscreen } = this.state;

    return (
      <Button
        onClick={this.handleToggleFullscreen}
        title="Toggle fullscreen"
        tabIndex={-1}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
        >
          <path d="M0 0h24v24H0z" fill="none" />
          {isFullscreen ? (
            <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
          ) : (
            <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
          )}
        </svg>
      </Button>
    );
  }
}
