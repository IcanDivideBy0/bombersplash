export default class EventEmitter {
  constructor() {
    this.listeners = {};
  }

  on(eventName, listener) {
    if (!this.listeners[eventName]) this.listeners[eventName] = [];
    this.listeners[eventName].push(listener);
  }

  once(eventName, listener) {
    this.on(eventName, (...args) => {
      this.removeListener(eventName, listener);
      listener(...args);
    });
  }

  removeListener(eventName, listener) {
    if (!this.listeners[eventName]) return;

    const index = this.listeners[eventName].indexOf(listener);
    if (~index) this.listeners[eventName].splice(index, 1);
  }

  removeAllListeners(eventName) {
    if (!this.listeners[eventName]) return;
    this.listeners[eventName].length = 0;
  }

  emit(eventName, ...data) {
    if (!this.listeners[eventName]) return;
    this.listeners[eventName].forEach(listener => listener(...data));
  }
}
