import { createEngine } from './banks.js';

// Node imports this module only to parse-check it; the worklet globals are browser-only.
if (typeof AudioWorkletProcessor === 'function') {
  class DiceResonatorProcessor extends AudioWorkletProcessor {
    constructor(...args) {
      super(...args);
      this.inbox = [];
      this.engine = createEngine(sampleRate);
      this.port.onmessage = (event) => {
        this.inbox.push(event.data);
      };
    }

    process(inputs, outputs) {
      const inbox = this.inbox;
      for (let index = 0; index < inbox.length; index += 1) {
        const message = inbox[index];
        if (message.type === 'steps') this.engine.handleSteps(message, currentTime);
        else if (message.type === 'add') this.engine.addBody(message.id, message.die, message.radius);
        else if (message.type === 'remove') this.engine.removeBody(message.id);
        else if (message.type === 'box') this.engine.setBox(message.W, message.H, message.D);
      }
      inbox.length = 0;
      this.engine.render(outputs[0][0], currentTime);
      return true;
    }
  }

  registerProcessor('dice-resonator', DiceResonatorProcessor);
}
