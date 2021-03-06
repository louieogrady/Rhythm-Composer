import React from "react";
import { Knob } from "react-rotary-knob";
import * as skins from "react-rotary-knob-skin-pack";

class BpmSlider extends React.Component {
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
    const maxDistance = 100;
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
    this.props.changeBpm(this.state.value, true);
  }


  render() {
    return (
      <React.Fragment>
        <Knob
          style={{
            width: '7vw',
            position: 'relative',
          }}
          onChange={value => {
            this.handleChange(value);
          }}
          onEnd={() => {
            this.onEnd();
          }}
          className="bottom-slider"
          min={10}
          defaultValue={120}
          max={200}
          value={this.state.value}
          unlockDistance={0}
          preciseMode={false}
          skin={skins.s4}
          {...this.props.rest}
        />
      <h5 className="bpm-slider" style={{marginLeft: "0.1rem"}}>Tempo (BPM)</h5>
      </React.Fragment>
    );
  }
}

export default BpmSlider;
