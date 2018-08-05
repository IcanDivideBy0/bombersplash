import React from "react";
import styled from "styled-components";
import debounce from "lodash.debounce";

const StickWrapper = styled.div`
  position: relative;
  width: 20vw;
  height: 20vw;
`;

const StickBackdrop = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  width: 40%;
  height: 40%;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.5);
`;

const StickButton = styled.div`
  position: absolute;
  width: 140%;
  height: 140%;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.5);
`;

export default class Stick extends React.PureComponent {
  componentDidMount() {
    window.addEventListener("resize", this.handleResize);

    const opt = { passive: false };
    this.rootNode.addEventListener("touchstart", this.handleTouchStart, opt);
  }

  componentWillUnmount() {
    window.removeEventListener("resize", this.handleResize);
    this.rootNode.removeEventListener("touchstart", this.handleTouchStart);

    this.cleanListeners();
  }

  cleanListeners() {
    window.document.removeEventListener("touchmove", this.handleTouchMove);
    window.document.removeEventListener("touchend", this.cleanListeners);
  }

  handleRootRef = ref => {
    this.rootNode = ref;
    this.updateRootSize();
  };

  updateRootSize = () => {
    if (!this.rootNode) return;
    this.rootRect = this.rootNode.getBoundingClientRect();
  };

  handleResize = debounce(this.updateRootSize, 100);

  handleTouchStart = evt => {
    const opt = { passive: false };
    this.touchId = evt.changedTouches[0].identifier;

    window.document.addEventListener("touchmove", this.handleTouchMove, opt);
    window.document.addEventListener("touchend", this.handleTouchEnd, opt);

    this.handleTouchMove(evt);
  };

  handleTouchMove = evt => {
    if (evt.changedTouches[0].identifier !== this.touchId) return;

    const touch = evt.touches.item(this.touchId);
    if (!touch) return;

    evt.preventDefault();

    const { onChange } = this.props;

    const halfWidth = this.rootRect.width / 2;
    const halfHeight = this.rootRect.height / 2;

    const rootCenter = {
      x: this.rootRect.x + halfWidth,
      y: this.rootRect.y + halfHeight
    };

    const deltaX = (touch.clientX - rootCenter.x) / (halfWidth * 0.4);
    const deltaY = (touch.clientY - rootCenter.y) / (halfHeight * 0.4);

    const hypot = Math.hypot(deltaX, deltaY);

    onChange({
      x: hypot < 1 ? deltaX : deltaX / hypot,
      y: hypot < 1 ? deltaY : deltaY / hypot
    });
  };

  handleTouchEnd = evt => {
    if (evt.changedTouches[0].identifier !== this.touchId) return;

    this.cleanListeners();

    const { onChange } = this.props;
    onChange({ x: 0, y: 0 });
  };

  render() {
    const { value, onChange, ...props } = this.props;

    return (
      <StickWrapper innerRef={this.handleRootRef} {...props}>
        <StickBackdrop>
          <StickButton
            style={{
              top: `${50 + value.y * 50}%`,
              left: `${50 + value.x * 50}%`
            }}
          />
        </StickBackdrop>
      </StickWrapper>
    );
  }
}
