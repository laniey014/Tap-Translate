// Generated by CoffeeScript 1.6.3
const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;;
var DEBUG, TapTranslate, install, requestBuilder, settingsObserver, shutdown, startup, uninstall, utils, windowListener;

Cu["import"]("resource://gre/modules/Services.jsm");

DEBUG = false;

TapTranslate = {
  _prefsBranch: "extensions.taptranslate.",
  _prefs: null,
  _contextMenus: [],
  init: function() {
    this.setDefaultPrefs();
    return this._prefs = Services.prefs.getBranch(this._prefsBranch);
  },
  uninit: function() {
    return this._prefs = null;
  },
  setDefaultPrefs: function() {
    var prefs;
    prefs = Services.prefs.getDefaultBranch(this._prefsBranch);
    return prefs.setCharPref("translation_language", "en");
  },
  setTranslationLanguage: function(language) {
    return this._prefs.setCharPref("translation_language", language);
  },
  install: function() {},
  uninstall: function() {},
  load: function(aWindow) {
    if (!aWindow) {
      return;
    }
    return this.setupUI(aWindow);
  },
  unload: function(aWindow) {
    if (!aWindow) {
      return;
    }
    return this.cleanupUI(aWindow);
  },
  setupUI: function(aWindow) {
    var menu, searchOnContext,
      _this = this;
    searchOnContext = {
      matches: function(aElement, aX, aY) {
        return aWindow.SelectionHandler.shouldShowContextMenu(aX, aY);
      }
    };
    menu = aWindow.NativeWindow.contextmenus.add(utils.t("Translate"), searchOnContext, function(target) {
      var text;
      text = utils.getSelectedText(aWindow);
      return _this._translate(aWindow, text);
    });
    return this._contextMenus.push(menu);
  },
  cleanupUI: function(aWindow) {
    this._contextMenus.forEach(function(menu) {
      return aWindow.NativeWindow.contextmenus.remove(menu);
    });
    return this._contextMenus = [];
  },
  _translate: function(aWindow, text) {
    var request, translationLanguage,
      _this = this;
    translationLanguage = this._prefs.getCharPref("translation_language");
    request = requestBuilder.build(translationLanguage, text, function(event) {
      var translation;
      translation = JSON.parse(event.target.responseText);
      return _this._showTranslation(aWindow, translation);
    }, function() {
      return _this._translationErrorNotify(aWindow);
    });
    return request.send();
  },
  _showTranslation: function(aWindow, translation) {
    var msg;
    msg = translation.sentences[0].trans;
    if (translation.dict) {
      msg += "\n";
      translation.dict.forEach(function(part) {
        var pos;
        msg += "\n";
        pos = utils.capitalize(part.pos);
        return msg += "" + pos + ": " + (part.terms.join(", "));
      });
    }
    return aWindow.NativeWindow.doorhanger.show(msg, "Translation", [
      {
        label: utils.t("Close")
      }
    ]);
  },
  _translationErrorNotify: function(aWindow) {
    var msg;
    msg = utils.t("TranslationRequestError");
    return aWindow.NativeWindow.toast.show(msg);
  }
};

requestBuilder = {
  url: "http://translate.google.com/translate_a/t",
  XMLHttpRequest: Cc["@mozilla.org/xmlextras/xmlhttprequest;1"],
  createXMLHttpRequest: function(params) {
    return Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest);
  },
  build: function(translationLanguage, text, successHandler, errorHandler) {
    var param, params, query, request, url, value;
    params = {
      client: "p",
      sl: "auto",
      tl: translationLanguage,
      text: text
    };
    query = [];
    for (param in params) {
      value = params[param];
      query.push("" + param + "=" + (encodeURIComponent(value)));
    }
    query = query.join("&");
    url = "" + this.url + "?" + query;
    request = this.createXMLHttpRequest();
    request.open("GET", url);
    request.addEventListener("load", successHandler, false);
    request.addEventListener("error", errorHandler, false);
    return request;
  }
};

utils = {
  _translations: null,
  _translations_uri: "chrome://taptranslate/locale/taptranslate.properties",
  log: function(msg) {
    if (!DEBUG) {
      return;
    }
    msg = "log: " + msg;
    Services.console.logStringMessage(msg);
    return Cu.reportError(msg);
  },
  inspect: function(object, prefix) {
    var key, type, value, _results;
    if (prefix == null) {
      prefix = "";
    }
    if (!DEBUG) {
      return;
    }
    _results = [];
    for (key in object) {
      value = object[key];
      type = typeof value;
      if (this.isObject(value)) {
        _results.push(this.inspect(value, "" + prefix + "{" + key + "} "));
      } else {
        _results.push(this.log("" + prefix + key + " => (" + type + ") value"));
      }
    }
    return _results;
  },
  isObject: function(obj) {
    return !!obj && obj.constructor === Object;
  },
  t: function(name) {
    if (!this._translations) {
      this._translations = Services.strings.createBundle(this._translations_uri);
    }
    try {
      return this._translations.GetStringFromName(name);
    } catch (_error) {
      return name;
    }
  },
  getSelectedText: function(aWindow) {
    var selection, win;
    win = aWindow.BrowserApp.selectedTab.window;
    selection = win.getSelection();
    if (!selection || selection.isCollapsed) {
      return "";
    }
    return selection.toString().trim();
  },
  capitalize: function(word) {
    return word.charAt(0).toUpperCase() + word.slice(1);
  }
};

install = function(aData, aReason) {
  return TapTranslate.install();
};

uninstall = function(aData, aReason) {
  if (aReason === ADDON_UNINSTALL) {
    return TapTranslate.uninstall;
  }
};

startup = function(aData, aReason) {
  var win, windows;
  settingsObserver.init();
  TapTranslate.init();
  windows = Services.wm.getEnumerator("navigator:browser");
  while (windows.hasMoreElements()) {
    win = windows.getNext().QueryInterface(Ci.nsIDOMWindow);
    if (win) {
      TapTranslate.load(win);
    }
  }
  return Services.wm.addListener(windowListener);
};

shutdown = function(aData, aReason) {
  var win, windows;
  if (aReason === APP_SHUTDOWN) {
    return;
  }
  Services.wm.removeListener(windowListener);
  windows = Services.wm.getEnumerator("navigator:browser");
  while (windows.hasMoreElements()) {
    win = windows.getNext().QueryInterface(Ci.nsIDOMWindow);
    if (win) {
      TapTranslate.unload(win);
    }
  }
  TapTranslate.uninit();
  return settingsObserver.uninit();
};

windowListener = {
  onOpenWindow: function(aWindow) {
    var win;
    win = aWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowInternal || Ci.nsIDOMWindow);
    return win.addEventListener("UIReady", function() {
      win.removeEventListener("UIReady", arguments.callee, false);
      return TapTranslate.load(win);
    }, false);
  },
  onCloseWindow: function() {},
  onWindowTitleChange: function() {}
};

settingsObserver = {
  init: function() {
    return Services.obs.addObserver(this, "addon-options-displayed", false);
  },
  uninit: function() {
    return Services.obs.removeObserver(this, "addon-options-displayed");
  },
  observe: function(subject, topic, data) {
    return this.fixTranslationMenu(subject.QueryInterface(Ci.nsIDOMDocument));
  },
  fixTranslationMenu: function(doc) {
    var menu;
    menu = doc.getElementById("tap-translate-translation-language-selector");
    if (!menu) {
      return;
    }
    return menu.watch("selectedIndex", function(prop, oldIndex, newIndex) {
      var language;
      language = menu.getItemAtIndex(newIndex).value;
      TapTranslate.setTranslationLanguage(language);
      return newIndex;
    });
  }
};
