import React from "react";
import hoistNonReactStatic from "hoist-non-react-statics";

import io from "socket.io-client";

const { Provider, Consumer } = React.createContext();

/**
 * Provider
 */

export class SocketProvider extends React.Component {
  constructor(props, ...args) {
    super(props, ...args);
    this.socket = io.connect(props.socketUrl);
  }

  render() {
    return <Provider value={this.socket} {...this.props} />;
  }
}

/**
 * Consumer
 */

function getDisplayName(WrappedComponent) {
  return WrappedComponent.displayName || WrappedComponent.name || "Component";
}

export function withSocket() {
  return WrappedComponent => {
    function WithSocket(props, ref) {
      return (
        <Consumer>
          {socket => <WrappedComponent socket={socket} ref={ref} {...props} />}
        </Consumer>
      );
    }
    WithSocket.displayName = `withSocket(${getDisplayName(WrappedComponent)})`;

    const Component = React.forwardRef(WithSocket);
    return hoistNonReactStatic(Component, WrappedComponent);
  };
}
