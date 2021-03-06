'use strict';


function Client(es, config, retryCount, onRetry) {
  retryCount = retryCount || 10;

  let client = new es.Client(getConfig());

  function init(reconnectAttempts) {
    client = new es.Client(getConfig());
    onRetry && onRetry(reconnectAttempts);
  }

  function retryError(err, reconnectAttempts) {
    return (err.message == 'No Living connections' && reconnectAttempts < retryCount);
  }

  function getConfig() {
    return {}.toString.call(config) === '[object Function]' ? config() : config
  };

  function asCallBack(func, args, reconnectAttempts) {
    reconnectAttempts = reconnectAttempts || 0;

    let newArgs = args.slice(0, -1);
    let cb = args[args.length - 1];
    newArgs.push(function (err, res) {
      if (err && retryError(err, ++reconnectAttempts)) {
        init(reconnectAttempts);
        return asCallBack(func, args, reconnectAttempts);
      }
      cb(err, res);
    });
    return func.apply(client, newArgs);
  }

  function asPromise(func, args, reconnectAttempts) {
    reconnectAttempts = reconnectAttempts || 0;

    return func.apply(client, args)
      .catch(err => {
        if (retryError(err, ++reconnectAttempts)) {
          init(reconnectAttempts);
          return asPromise(func, args, reconnectAttempts);
        }
        throw err;
      });
  }


  function wrapFunction() {
    let args = Array.from(arguments);
    let func = args.shift();
    if (typeof args[args.length - 1] == 'function') {
      return asCallBack(func, args);
    } else {
      return asPromise(func, args);
    }

  }

  Object.keys(client.__proto__)
    .filter(p => typeof client[p] == 'function')
    .forEach(p => {
      let proto = client.__proto__;
      let func = proto[p];
      proto[p] = wrapFunction.bind(null, func);
    });


  return client;
}

module.exports = Client;