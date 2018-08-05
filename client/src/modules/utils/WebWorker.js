export default class WebWorker {
  constructor(fn) {
    let code = fn.toString();
    code = code.substring(code.indexOf("{") + 1, code.lastIndexOf("}"));
    const blob = new Blob([code]);

    return new Worker(URL.createObjectURL(blob));
  }
}
