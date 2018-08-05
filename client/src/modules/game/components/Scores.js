import React from "react";
import styled from "styled-components";

// width: 485px;
// height: 34px;
const ScoresWrapper = styled.div`
  position: relative;
  width: 500px;
  height: 83px;
  padding: 34px 8px 16px;
  display: flex;
  align-items: stretch;
  pointer-events: none;

  .green {
    background-color: #447733;
    border: 3px solid #649154;
  }
  .blue {
    background-color: #337799;
    border: 3px solid #5ba3c7;
  }
  .red {
    background-color: #92263b;
    border: 3px solid #d04648;
  }
  .yellow {
    background-color: #bf7b3f;
    border: 3px solid #cfbc44;
  }

  .prism {
    position: absolute;
    top: 24px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
  }
  .prism-0 {
    left: 3px;
  }
  .prism-1 {
    right: 3px;
  }

  .green-prism {
    background-color: #447733;
  }
  .blue-prism {
    background-color: #337799;
  }
  .red-prism {
    background-color: #92263b;
  }
  .yellow-prism {
    background-color: #bf7b3f;
  }

  .foreground {
    display: block;
    position absolute;
    left: 50%;
    top: 0;
    transform: translateX(-50%);
  }
`;

export default class Scores extends React.Component {
  render() {
    const { scores, ...props } = this.props;

    return (
      <ScoresWrapper {...props}>
        {Object.keys(scores).map(teamName => (
          <div
            key={teamName}
            className={teamName}
            style={{ flex: scores[teamName] }}
          />
        ))}

        {Object.keys(scores).map((teamName, idx) => (
          <div
            key={teamName}
            className={`prism prism-${idx} ${teamName}-prism `}
          />
        ))}

        <img
          src={require("./images/scores-fg.png")}
          alt=""
          className="foreground"
        />
      </ScoresWrapper>
    );
  }
}
