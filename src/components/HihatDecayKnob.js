import React from "react";
import { Knob } from "react-rotary-knob";
import * as skins from "react-rotary-knob-skin-pack";

class HihatDecayKnob extends React.Component {
  state = {
    value: this.props.value
  };
  componentDidUpdate(prevProps, prevState) {
    if (this.props.value !== prevProps.value) {
      this.setState({
        value: this.props.value
      });
    }
  }
  handleChange = value => {
    const maxDistance = 1;
    let distance = Math.abs(value - this.state.value);
    if (distance > maxDistance) {
      return;
    } else {
      this.setState({
        value: value
      });
    }
  };

  onEnd = () => {
    this.props.changeCymbalDecayLevel(this.state.value, true);
  }

  render() {
    return (
      <React.Fragment>
        <Knob
          className="whindUp"
          style={{
            width: "auto",
            height: "auto",
          }}
          onChange={value => {
            this.handleChange(value);
          }}
          onEnd={() => {
            this.onEnd();
          }}
          min={0.25}
          max={1.5}
          value={this.state.value}
          unlockDistance={0}
          preciseMode={false}
          skin={skins.s7}
          {...this.props.rest}
        />{" "}
        <h5 style={{
          // marginTop: "-0.3rem",
        }}>Attack</h5>
      </React.Fragment>
    );
  }
}

export default HihatDecayKnob;
