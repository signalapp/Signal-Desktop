/* global window */

// eslint-disable-next-line func-names
(function() {
  window.libloki = window.libloki || {};

  function getGuardNodes() {
    return window.Signal.Data.getGuardNodes();
  }

  function updateGuardNodes(nodes) {
    return window.Signal.Data.updateGuardNodes(nodes);
  }

  window.libloki.storage = {
    getGuardNodes,
    updateGuardNodes,
  };
})();
