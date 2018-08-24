(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _idb = require('idb');

var _idb2 = _interopRequireDefault(_idb);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Common database helper functions.
 */

var DBHelper = function () {
  function DBHelper() {
    _classCallCheck(this, DBHelper);
  }

  _createClass(DBHelper, null, [{
    key: 'mapMarkerForRestaurant',


    /**
     * @Map marker for a restaurant.
     */
    value: function mapMarkerForRestaurant(restaurant, map) {
      DBHelper.addTitleToMap();
      var marker = new google.maps.Marker({
        position: restaurant.latlng,
        title: restaurant.name,
        url: DBHelper.urlForRestaurant(restaurant),
        map: map,
        animation: google.maps.Animation.DROP
      });
      return marker;
    }
    /**
     * @add attribute title to <iframe> in Google Map to improve the accessibility
     */

  }, {
    key: 'addTitleToMap',
    value: function addTitleToMap() {
      google.maps.event.addListenerOnce(map, 'idle', function () {
        document.getElementsByTagName('iframe')[0].title = 'Google Maps';
      });
    }

    /**
     * @open database to store data retrieved from the server in indexedDB API
     */

  }, {
    key: 'openDatabase',
    value: function openDatabase() {
      if (!navigator.serviceWorker) {
        return Promise.resolve();
      } else {
        return _idb2.default.open('restaurants', 3, function (upgradeDb) {
          upgradeDb.createObjectStore('restaurants', { keyPath: 'id' });
          var reviewStore = upgradeDb.createObjectStore('reviews', { keyPath: 'id' });
          reviewStore.createIndex('restaurant_id', 'restaurant_id', { unique: false });
          upgradeDb.createObjectStore('offline-reviews', { keyPath: 'updatedAt' });
        });
      }
    }
    /**
     * @get data from a store in IndexedDB if it is available
     */

  }, {
    key: 'getCachedIndexedDB',
    value: function getCachedIndexedDB(store_name) {
      var dbPromise = DBHelper.openDatabase();

      return dbPromise.then(function (db) {
        if (!db) return;
        var tx = db.transaction(store_name);
        var store = tx.objectStore(store_name);
        return store.getAll();
      });
    }

    /**
     * @store the data in IndexedDB after fetching it from the server
     * @param datas: are retrieved from the server, store_name: {string}
     */

  }, {
    key: 'storeDataIndexedDb',
    value: function storeDataIndexedDb(datas, store_name) {
      var dbPromise = DBHelper.openDatabase();

      dbPromise.then(function (db) {
        if (!db) return;
        var tx = db.transaction(store_name, 'readwrite');
        var store = tx.objectStore(store_name);

        datas.forEach(function (data) {
          store.put(data);
        });
        return tx.complete;
      });
    }
    /**
     * @fetch all restaurants form IndexedDB if they exist otherwise fetch from the server.
     */

  }, {
    key: 'fetchRestaurants',
    value: function fetchRestaurants(callback) {
      //check if data exists in indexDB API if it does return callback
      DBHelper.getCachedIndexedDB('restaurants').then(function (results) {
        if (results && results.length > 0) {
          callback(null, results);
        } else {
          // Use else condition to avoid fetching from sails server
          // because updating favorite on the sails server is not persistent
          // and to get data from IndexedDB only
          fetch(DBHelper.DATABASE_URL + '/restaurants').then(function (response) {
            return response.json();
          }).then(function (restaurants) {
            //store data in indexDB API after fetching
            DBHelper.storeDataIndexedDb(restaurants, 'restaurants');
            return callback(null, restaurants);
          }).catch(function (err) {
            return callback(err, null);
          });
        }
      });
    }
    /**
     * @fetch all reviews form IndexedDB if they exist otherwise fetch from the server.
     */

  }, {
    key: 'fetchRestaurantReviews',
    value: function fetchRestaurantReviews(restaurant, callback) {
      var dbPromise = DBHelper.openDatabase();

      dbPromise.then(function (db) {
        if (!db) return;

        var tx = db.transaction('reviews');
        var store = tx.objectStore('reviews');
        var index = store.index('restaurant_id');

        index.getAll(restaurant.id).then(function (results) {
          callback(null, results);

          if (!navigator.onLine) {
            return;
          }

          fetch(DBHelper.DATABASE_URL + '/reviews/?restaurant_id=' + restaurant.id).then(function (response) {
            return response.json();
          }).then(function (reviews) {
            //store data in indexDB API after fetching
            var reviewsLen = reviews.length;
            if (reviewsLen >= 29) {
              for (var i = 0; i < reviewsLen - 20; i++) {
                DBHelper.deleteRestaurantReviews(reviews[i].id);
              }
            }
            DBHelper.storeDataIndexedDb(reviews, 'reviews');
            callback(null, reviews);
          }).catch(function (err) {
            callback(err, null);
          });
        });
      });
    }

    /**
     * @fetch a restaurant by its ID.
     */

  }, {
    key: 'fetchRestaurantById',
    value: function fetchRestaurantById(id, callback) {
      // fetch all restaurants with proper error handling.
      DBHelper.fetchRestaurants(function (error, restaurants) {
        if (error) {
          callback(error, null);
        } else {
          var restaurant = restaurants.find(function (r) {
            return r.id == id;
          });
          if (restaurant) {
            // Got the restaurant
            callback(null, restaurant);
          } else {
            // Restaurant does not exist in the database
            callback('Restaurant does not exist', null);
          }
        }
      });
    }

    /**
     * @fetch restaurants by a cuisine type with proper error handling.
     */

  }, {
    key: 'fetchRestaurantByCuisine',
    value: function fetchRestaurantByCuisine(cuisine, callback) {
      // Fetch all restaurants  with proper error handling
      DBHelper.fetchRestaurants(function (error, restaurants) {
        if (error) {
          callback(error, null);
        } else {
          // Filter restaurants to have only given cuisine type
          var results = restaurants.filter(function (r) {
            return r.cuisine_type == cuisine;
          });
          callback(null, results);
        }
      });
    }

    /**
     * @fetch restaurants by a neighborhood with proper error handling.
     */

  }, {
    key: 'fetchRestaurantByNeighborhood',
    value: function fetchRestaurantByNeighborhood(neighborhood, callback) {
      // Fetch all restaurants
      DBHelper.fetchRestaurants(function (error, restaurants) {
        if (error) {
          callback(error, null);
        } else {
          // Filter restaurants to have only given neighborhood
          var results = restaurants.filter(function (r) {
            return r.neighborhood == neighborhood;
          });
          callback(null, results);
        }
      });
    }

    /**
     * @fetch restaurants by a cuisine and a neighborhood with proper error handling.
     */

  }, {
    key: 'fetchRestaurantByCuisineAndNeighborhood',
    value: function fetchRestaurantByCuisineAndNeighborhood(cuisine, neighborhood, callback) {
      // Fetch all restaurants
      DBHelper.fetchRestaurants(function (error, restaurants) {
        if (error) {
          callback(error, null);
        } else {
          var results = restaurants;
          if (cuisine != 'all') {
            // filter by cuisine
            results = results.filter(function (r) {
              return r.cuisine_type == cuisine;
            });
          }
          if (neighborhood != 'all') {
            // filter by neighborhood
            results = results.filter(function (r) {
              return r.neighborhood == neighborhood;
            });
          }
          callback(null, results);
        }
      });
    }
  }, {
    key: 'fetchRestaurantByCuisineNeighborhoodAndFavorite',
    value: function fetchRestaurantByCuisineNeighborhoodAndFavorite(cuisine, neighborhood, favorite, callback) {
      // Fetch all restaurants
      DBHelper.fetchRestaurants(function (error, restaurants) {
        if (error) {
          callback(error, null);
        } else {
          var results = restaurants;
          if (cuisine != 'all') {
            // filter by cuisine
            results = results.filter(function (r) {
              return r.cuisine_type == cuisine;
            });
          }
          if (neighborhood != 'all') {
            // filter by neighborhood
            results = results.filter(function (r) {
              return r.neighborhood == neighborhood;
            });
          }
          if (favorite == 'true') {
            results = results.filter(function (r) {
              return r.is_favorite == 'true';
            });
          }
          callback(null, results);
        }
      });
    }

    /**
     * @fetch all neighborhoods with proper error handling.
     */

  }, {
    key: 'fetchNeighborhoods',
    value: function fetchNeighborhoods(callback) {
      // Fetch all restaurants
      DBHelper.fetchRestaurants(function (error, restaurants) {
        if (error) {
          callback(error, null);
        } else {
          // Get all neighborhoods from all restaurants
          var neighborhoods = restaurants.map(function (v, i) {
            return restaurants[i].neighborhood;
          });
          // Remove duplicates from neighborhoods
          var uniqueNeighborhoods = neighborhoods.filter(function (v, i) {
            return neighborhoods.indexOf(v) == i;
          });
          callback(null, uniqueNeighborhoods);
        }
      });
    }

    /**
     * @fetch all cuisines with proper error handling.
     */

  }, {
    key: 'fetchCuisines',
    value: function fetchCuisines(callback) {
      // Fetch all restaurants
      DBHelper.fetchRestaurants(function (error, restaurants) {
        if (error) {
          callback(error, null);
        } else {
          // Get all cuisines from all restaurants
          var cuisines = restaurants.map(function (v, i) {
            return restaurants[i].cuisine_type;
          });
          // Remove duplicates from cuisines
          var uniqueCuisines = cuisines.filter(function (v, i) {
            return cuisines.indexOf(v) == i;
          });
          callback(null, uniqueCuisines);
        }
      });
    }

    /**
     * @restaurant page URL.
     */

  }, {
    key: 'urlForRestaurant',
    value: function urlForRestaurant(restaurant) {
      return './restaurant.html?id=' + restaurant.id;
    }

    /**
     * @restaurant image URL.
     */

  }, {
    key: 'imageUrlForRestaurant',
    value: function imageUrlForRestaurant(restaurant) {
      if (restaurant.photograph === undefined) {
        restaurant.photograph = 10;
      }
      return '/img/' + restaurant.photograph + '.webp';
    }
  }, {
    key: 'deleteRestaurantReviews',
    value: function deleteRestaurantReviews(review_id) {
      fetch(DBHelper.DATABASE_URL + '/reviews/' + review_id, {
        method: 'DELETE'
      }).then(function (response) {
        return response;
      }).then(function (data) {
        return data;
      }).catch(function (err) {
        console.log('Error', err);
      });
    }

    /**
     * @post review_data to the server when a user submits a review
     * online: keep it in the reviews store in IndexedDB
     * offline: keep it in the offlne-reviews in IndexedDB
     * @param review_data is from a user fills out the form
     */

  }, {
    key: 'createRestaurantReview',
    value: function createRestaurantReview(review_data) {
      return fetch(DBHelper.DATABASE_URL + '/reviews', {
        method: 'POST',
        cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
        credentials: 'same-origin',
        body: JSON.stringify(review_data),
        headers: {
          'content-type': 'application/json'
        },
        mode: 'cors',
        redirect: 'follow',
        referrer: 'no-referrer'
      }).then(function (response) {
        response.json().then(function (review_data) {
          /* keep datas in IndexedDB after posting data to the server when online */
          DBHelper.storeDataIndexedDb([review_data], 'reviews');
          return review_data;
        });
      }).catch(function (error) {
        review_data['updatedAt'] = new Date().getTime();
        /* keep datas in IndexedDB after posting data to the server when offline*/
        DBHelper.storeDataIndexedDb([review_data], 'offline-reviews');
        console.log('Review stored offline in IDB');
        return;
      });
    }

    /**
     * @clear data in the offline-reviews store
     */

  }, {
    key: 'clearOfflineReviews',
    value: function clearOfflineReviews() {
      var dbPromise = DBHelper.openDatabase();
      dbPromise.then(function (db) {
        var tx = db.transaction('offline-reviews', 'readwrite');
        var store = tx.objectStore('offline-reviews');
        store.clear();
      });
      return;
    }

    /**
     * @get reviews from offline-stores in IndexedDB when a user go from offline to online
     */

  }, {
    key: 'createOfflineReview',
    value: function createOfflineReview() {
      DBHelper.openDatabase().then(function (db) {
        if (!db) return;
        var tx = db.transaction('offline-reviews', 'readwrite');
        var store = tx.objectStore('offline-reviews');

        store.getAll().then(function (offlineReviews) {
          offlineReviews.forEach(function (review) {
            DBHelper.createRestaurantReview(review);
          });
          DBHelper.clearOfflineReviews();
        });
      });
    }
    /**
     *@when online update a value of a restaurant's favorite by sending the PUT request to the server
     *and store the data to IndexedDB so it can be used when offline
    */

  }, {
    key: 'toggleFavorite',
    value: function toggleFavorite(restaurant, isFavorite) {
      return fetch(DBHelper.DATABASE_URL + '/restaurants/' + restaurant.id + '/?is_favorite=' + isFavorite, {
        method: 'PUT'
      }).then(function (response) {
        console.log('updated API restaurant: ' + restaurant.id + ' favorite : ' + isFavorite);
        return response.json();
      }).then(function (data) {
        DBHelper.storeDataIndexedDb([data], 'restaurants');
        console.log('updated IDB restaurant: ' + restaurant.id + ' favorite : ' + isFavorite);
        return data;
      }).catch(function (error) {
        // convert from boolean to string because the API uses strings 'true' and 'false'
        restaurant.is_favorite = isFavorite ? 'true' : 'false';

        DBHelper.storeDataIndexedDb([restaurant], 'restaurants');
        console.log('store favorite offline');
        return;
      });
    }

    /**
    * @fill favorites in HTML so it can be used by both main and restaurant page
    */

  }, {
    key: 'fillFavoritesHTML',
    value: function fillFavoritesHTML(restaurant) {
      var label = document.createElement('label');
      label.setAttribute('aria-label', 'Label for checking favorite');
      label.className = 'fav-container';

      var icon = document.createElement('i');
      icon.className = 'fas fa-heart';
      label.append(icon);

      var input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('aria-label', 'Select favorite');

      if (restaurant.is_favorite == 'true') {
        icon.style.color = '#d32f2f';
      } else {
        icon.style.color = '#aeb0b1';
      }

      input.checked = restaurant.is_favorite == 'true';
      input.addEventListener('change', function (event) {
        event.preventDefault();
        if (input.checked == true) {
          DBHelper.toggleFavorite(restaurant, input.checked);
          icon.style.color = '#d32f2f';
        } else {
          DBHelper.toggleFavorite(restaurant, input.checked);
          icon.style.color = '#aeb0b1';
        }
      });
      label.append(input);
      return label;
    }

    /*@create these functions to add online status to the browser
     * when it is offline it will store review submissions in offline-reviews IndexedDB
     * when connectivity is reestablished, it will call the function to show new reviews on the page
    */

  }, {
    key: 'onGoOnline',
    value: function onGoOnline() {
      console.log('Going online');
      DBHelper.createOfflineReview();
    }
  }, {
    key: 'onGoOffline',
    value: function onGoOffline() {
      console.log('Going offline');
    }
  }, {
    key: 'DATABASE_URL',

    /**
     * Database URL.
     * Change this to restaurants.json file location on your server.
     */
    get: function get() {
      //const port = 1337;// Change this to your server port
      //return `https://restaurant-reviews-api.herokuapp.com/:${port}`;
      return 'https://restaurant-reviews-api.herokuapp.com';
    }
  }]);

  return DBHelper;
}();

window.addEventListener('online', DBHelper.onGoOnline);
window.addEventListener('offline', DBHelper.onGoOffline);

/* @register ServiceWorker to cache data for the site
   * to allow any page that has been visited is accessible offline
   */
navigator.serviceWorker.register('./sw.js').then(function (reg) {
  // Registration was successful
  console.log('ServiceWorker registration successful with scope: ', reg.scope);
  if (!navigator.serviceWorker.controller) {
    return;
  }
  if (reg.waiting) {
    _updateReady(reg.waiting);
    return;
  }
  if (reg.installing) {
    _trackInstalling(reg.installing);
    return;
  }

  reg.addEventListener('updatefound', function () {
    _trackInstalling(reg.installing);
  });

  var refreshing;
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (refreshing) return;
    refreshing = true;
  });
}).catch(function () {
  console.log('Service worker registration failed');
});

var _updateReady = function _updateReady(worker) {
  worker.postMessage({ action: 'skipWaiting' });
};

var _trackInstalling = function _trackInstalling(worker) {
  var indexController = undefined;
  worker.addEventListener('stateChange', function () {
    if (worker.state == 'installed') {
      indexController._updateReady(worker);
    }
  });
};

exports.default = DBHelper;

},{"idb":3}],2:[function(require,module,exports){
'use strict';

var _dbhelper = require('./dbhelper');

var _dbhelper2 = _interopRequireDefault(_dbhelper);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var markers = [];

/**
 * Fetch neighborhoods and cuisines as soon as the page is loaded.
 */
document.addEventListener('DOMContentLoaded', function () {
  _dbhelper2.default.addTitleToMap();
  initMap();
  fetchNeighborhoods();
  fetchCuisines();
});

/**
 * Initialize Google map, called from HTML.
 */
var initMap = function initMap() {
  if (typeof google !== 'undefined') {
    var loc = {
      lat: 40.722216,
      lng: -73.987501
    };
    self.map = new google.maps.Map(document.getElementById('map'), {
      zoom: 12,
      center: loc,
      scrollwheel: false
    });
    self.updateRestaurants();
  }
  self.updateRestaurants();
};

/**
 * Add markers for current restaurants to the map.
 */
var addMarkersToMap = function addMarkersToMap(restaurants) {
  restaurants.forEach(function (restaurant) {
    // Add marker to the map
    var marker = _dbhelper2.default.mapMarkerForRestaurant(restaurant, self.map);
    google.maps.event.addListener(marker, 'click', function () {
      window.location.href = marker.url;
    });
    markers.push(marker);
  });
};

/**
 * Fetch all neighborhoods and set their HTML.
 */
var fetchNeighborhoods = function fetchNeighborhoods() {
  _dbhelper2.default.fetchNeighborhoods(function (error, neighborhoods) {
    if (error) {
      // Got an error
      console.error(error);
    } else {
      fillNeighborhoodsHTML(neighborhoods);
    }
  });
};

/**
 * Set neighborhoods HTML.
 */
var fillNeighborhoodsHTML = function fillNeighborhoodsHTML(neighborhoods) {
  var select = document.getElementById('neighborhoods-select');
  neighborhoods.forEach(function (neighborhood) {
    var option = document.createElement('option');
    option.innerHTML = neighborhood;
    option.setAttribute('value', neighborhood);
    option.setAttribute('role', 'option');
    select.append(option);
  });
};

/**
 * Fetch all cuisines and set their HTML.
 */
var fetchCuisines = function fetchCuisines() {
  _dbhelper2.default.fetchCuisines(function (error, cuisines) {
    if (error) {
      // Got an error!
      console.error(error);
    } else {
      fillCuisinesHTML(cuisines);
    }
  });
};

/**
 * Set cuisines HTML.
 */
var fillCuisinesHTML = function fillCuisinesHTML(cuisines) {
  var select = document.getElementById('cuisines-select');

  cuisines.forEach(function (cuisine) {
    var option = document.createElement('option');
    option.innerHTML = cuisine;
    option.setAttribute('value', cuisine);
    option.setAttribute('role', 'option');
    select.append(option);
  });
};

/**
 * Create restaurant HTML.
 */
var createRestaurantHTML = function createRestaurantHTML(restaurant) {
  var li = document.createElement('li');

  var image = document.createElement('img');
  image.className = 'restaurant-imgs';
  image.src = _dbhelper2.default.imageUrlForRestaurant(restaurant);
  image.alt = restaurant.name + ' is ' + restaurant.cuisine_type + ' restaurant';
  li.append(image);

  var nameWrap = document.createElement('div');
  nameWrap.className = 'name-wrap';
  var name = document.createElement('h3');
  name.innerHTML = restaurant.name;
  nameWrap.append(name);
  //import the fillFavoritesHTML from dbhelper.js
  nameWrap.append(_dbhelper2.default.fillFavoritesHTML(restaurant));
  li.append(nameWrap);

  var addressWrap = document.createElement('div');
  addressWrap.className = 'address-wrap';
  var neighborhood = document.createElement('p');
  neighborhood.innerHTML = restaurant.neighborhood;
  addressWrap.append(neighborhood);

  var address = document.createElement('p');
  address.innerHTML = restaurant.address;
  addressWrap.append(address);
  li.append(addressWrap);

  var more = document.createElement('a');
  more.innerHTML = 'View Details';
  more.href = _dbhelper2.default.urlForRestaurant(restaurant);
  li.append(more);

  return li;
};

/**
 * Clear current restaurants, their HTML and remove their map markers.
 */
var resetRestaurants = function resetRestaurants(restaurants) {
  // Remove all restaurants
  restaurants = [];
  var ul = document.getElementById('restaurants-list');
  ul.innerHTML = '';

  // Remove all map markers
  markers.forEach(function (m) {
    return m.setMap(null);
  });
  markers = [];
  self.restaurants = restaurants;
};

/**
 * Create all restaurants HTML and add them to the webpage.
 */
var fillRestaurantsHTML = function fillRestaurantsHTML(restaurants) {
  var ul = document.getElementById('restaurants-list');

  restaurants.forEach(function (restaurant) {
    ul.append(createRestaurantHTML(restaurant));
  });
  if (typeof google !== 'undefined') {
    addMarkersToMap(restaurants);
  }
};

/**
 * Update page and map for current restaurants and make it global so
 * it allows index.html use this function to update the content
 */
self.updateRestaurants = function () {
  var cSelect = document.getElementById('cuisines-select');
  var nSelect = document.getElementById('neighborhoods-select');
  var fSelect = document.getElementById('favorites-select');

  var cIndex = cSelect.selectedIndex;
  var nIndex = nSelect.selectedIndex;
  var fIndex = fSelect.selectedIndex;

  var cuisine = cSelect[cIndex].value;
  var neighborhood = nSelect[nIndex].value;
  var favorite = fSelect[fIndex].value;

  _dbhelper2.default.fetchRestaurantByCuisineNeighborhoodAndFavorite(cuisine, neighborhood, favorite, function (error, restaurants) {
    if (error) {
      // Got an error!
      console.error(error);
    } else {
      resetRestaurants(restaurants);
      fillRestaurantsHTML(restaurants);
    }
  });
};

},{"./dbhelper":1}],3:[function(require,module,exports){
'use strict';

(function() {
  function toArray(arr) {
    return Array.prototype.slice.call(arr);
  }

  function promisifyRequest(request) {
    return new Promise(function(resolve, reject) {
      request.onsuccess = function() {
        resolve(request.result);
      };

      request.onerror = function() {
        reject(request.error);
      };
    });
  }

  function promisifyRequestCall(obj, method, args) {
    var request;
    var p = new Promise(function(resolve, reject) {
      request = obj[method].apply(obj, args);
      promisifyRequest(request).then(resolve, reject);
    });

    p.request = request;
    return p;
  }

  function promisifyCursorRequestCall(obj, method, args) {
    var p = promisifyRequestCall(obj, method, args);
    return p.then(function(value) {
      if (!value) return;
      return new Cursor(value, p.request);
    });
  }

  function proxyProperties(ProxyClass, targetProp, properties) {
    properties.forEach(function(prop) {
      Object.defineProperty(ProxyClass.prototype, prop, {
        get: function() {
          return this[targetProp][prop];
        },
        set: function(val) {
          this[targetProp][prop] = val;
        }
      });
    });
  }

  function proxyRequestMethods(ProxyClass, targetProp, Constructor, properties) {
    properties.forEach(function(prop) {
      if (!(prop in Constructor.prototype)) return;
      ProxyClass.prototype[prop] = function() {
        return promisifyRequestCall(this[targetProp], prop, arguments);
      };
    });
  }

  function proxyMethods(ProxyClass, targetProp, Constructor, properties) {
    properties.forEach(function(prop) {
      if (!(prop in Constructor.prototype)) return;
      ProxyClass.prototype[prop] = function() {
        return this[targetProp][prop].apply(this[targetProp], arguments);
      };
    });
  }

  function proxyCursorRequestMethods(ProxyClass, targetProp, Constructor, properties) {
    properties.forEach(function(prop) {
      if (!(prop in Constructor.prototype)) return;
      ProxyClass.prototype[prop] = function() {
        return promisifyCursorRequestCall(this[targetProp], prop, arguments);
      };
    });
  }

  function Index(index) {
    this._index = index;
  }

  proxyProperties(Index, '_index', [
    'name',
    'keyPath',
    'multiEntry',
    'unique'
  ]);

  proxyRequestMethods(Index, '_index', IDBIndex, [
    'get',
    'getKey',
    'getAll',
    'getAllKeys',
    'count'
  ]);

  proxyCursorRequestMethods(Index, '_index', IDBIndex, [
    'openCursor',
    'openKeyCursor'
  ]);

  function Cursor(cursor, request) {
    this._cursor = cursor;
    this._request = request;
  }

  proxyProperties(Cursor, '_cursor', [
    'direction',
    'key',
    'primaryKey',
    'value'
  ]);

  proxyRequestMethods(Cursor, '_cursor', IDBCursor, [
    'update',
    'delete'
  ]);

  // proxy 'next' methods
  ['advance', 'continue', 'continuePrimaryKey'].forEach(function(methodName) {
    if (!(methodName in IDBCursor.prototype)) return;
    Cursor.prototype[methodName] = function() {
      var cursor = this;
      var args = arguments;
      return Promise.resolve().then(function() {
        cursor._cursor[methodName].apply(cursor._cursor, args);
        return promisifyRequest(cursor._request).then(function(value) {
          if (!value) return;
          return new Cursor(value, cursor._request);
        });
      });
    };
  });

  function ObjectStore(store) {
    this._store = store;
  }

  ObjectStore.prototype.createIndex = function() {
    return new Index(this._store.createIndex.apply(this._store, arguments));
  };

  ObjectStore.prototype.index = function() {
    return new Index(this._store.index.apply(this._store, arguments));
  };

  proxyProperties(ObjectStore, '_store', [
    'name',
    'keyPath',
    'indexNames',
    'autoIncrement'
  ]);

  proxyRequestMethods(ObjectStore, '_store', IDBObjectStore, [
    'put',
    'add',
    'delete',
    'clear',
    'get',
    'getAll',
    'getKey',
    'getAllKeys',
    'count'
  ]);

  proxyCursorRequestMethods(ObjectStore, '_store', IDBObjectStore, [
    'openCursor',
    'openKeyCursor'
  ]);

  proxyMethods(ObjectStore, '_store', IDBObjectStore, [
    'deleteIndex'
  ]);

  function Transaction(idbTransaction) {
    this._tx = idbTransaction;
    this.complete = new Promise(function(resolve, reject) {
      idbTransaction.oncomplete = function() {
        resolve();
      };
      idbTransaction.onerror = function() {
        reject(idbTransaction.error);
      };
      idbTransaction.onabort = function() {
        reject(idbTransaction.error);
      };
    });
  }

  Transaction.prototype.objectStore = function() {
    return new ObjectStore(this._tx.objectStore.apply(this._tx, arguments));
  };

  proxyProperties(Transaction, '_tx', [
    'objectStoreNames',
    'mode'
  ]);

  proxyMethods(Transaction, '_tx', IDBTransaction, [
    'abort'
  ]);

  function UpgradeDB(db, oldVersion, transaction) {
    this._db = db;
    this.oldVersion = oldVersion;
    this.transaction = new Transaction(transaction);
  }

  UpgradeDB.prototype.createObjectStore = function() {
    return new ObjectStore(this._db.createObjectStore.apply(this._db, arguments));
  };

  proxyProperties(UpgradeDB, '_db', [
    'name',
    'version',
    'objectStoreNames'
  ]);

  proxyMethods(UpgradeDB, '_db', IDBDatabase, [
    'deleteObjectStore',
    'close'
  ]);

  function DB(db) {
    this._db = db;
  }

  DB.prototype.transaction = function() {
    return new Transaction(this._db.transaction.apply(this._db, arguments));
  };

  proxyProperties(DB, '_db', [
    'name',
    'version',
    'objectStoreNames'
  ]);

  proxyMethods(DB, '_db', IDBDatabase, [
    'close'
  ]);

  // Add cursor iterators
  // TODO: remove this once browsers do the right thing with promises
  ['openCursor', 'openKeyCursor'].forEach(function(funcName) {
    [ObjectStore, Index].forEach(function(Constructor) {
      // Don't create iterateKeyCursor if openKeyCursor doesn't exist.
      if (!(funcName in Constructor.prototype)) return;

      Constructor.prototype[funcName.replace('open', 'iterate')] = function() {
        var args = toArray(arguments);
        var callback = args[args.length - 1];
        var nativeObject = this._store || this._index;
        var request = nativeObject[funcName].apply(nativeObject, args.slice(0, -1));
        request.onsuccess = function() {
          callback(request.result);
        };
      };
    });
  });

  // polyfill getAll
  [Index, ObjectStore].forEach(function(Constructor) {
    if (Constructor.prototype.getAll) return;
    Constructor.prototype.getAll = function(query, count) {
      var instance = this;
      var items = [];

      return new Promise(function(resolve) {
        instance.iterateCursor(query, function(cursor) {
          if (!cursor) {
            resolve(items);
            return;
          }
          items.push(cursor.value);

          if (count !== undefined && items.length == count) {
            resolve(items);
            return;
          }
          cursor.continue();
        });
      });
    };
  });

  var exp = {
    open: function(name, version, upgradeCallback) {
      var p = promisifyRequestCall(indexedDB, 'open', [name, version]);
      var request = p.request;

      if (request) {
        request.onupgradeneeded = function(event) {
          if (upgradeCallback) {
            upgradeCallback(new UpgradeDB(request.result, event.oldVersion, request.transaction));
          }
        };
      }

      return p.then(function(db) {
        return new DB(db);
      });
    },
    delete: function(name) {
      return promisifyRequestCall(indexedDB, 'deleteDatabase', [name]);
    }
  };

  if (typeof module !== 'undefined') {
    module.exports = exp;
    module.exports.default = module.exports;
  }
  else {
    self.idb = exp;
  }
}());

},{}]},{},[2,1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJqcy9kYmhlbHBlci5qcyIsImpzL21haW4uanMiLCJub2RlX21vZHVsZXMvaWRiL2xpYi9pZGIuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTs7Ozs7Ozs7QUFFQTs7Ozs7Ozs7QUFFQTs7OztJQUlNLFE7Ozs7Ozs7OztBQVdKOzs7MkNBRzhCLFUsRUFBWSxHLEVBQUs7QUFDN0MsZUFBUyxhQUFUO0FBQ0EsVUFBTSxTQUFTLElBQUksT0FBTyxJQUFQLENBQVksTUFBaEIsQ0FBdUI7QUFDcEMsa0JBQVUsV0FBVyxNQURlO0FBRXBDLGVBQU8sV0FBVyxJQUZrQjtBQUdwQyxhQUFLLFNBQVMsZ0JBQVQsQ0FBMEIsVUFBMUIsQ0FIK0I7QUFJcEMsYUFBSyxHQUorQjtBQUtwQyxtQkFBVyxPQUFPLElBQVAsQ0FBWSxTQUFaLENBQXNCO0FBTEcsT0FBdkIsQ0FBZjtBQU9BLGFBQU8sTUFBUDtBQUNEO0FBQ0Q7Ozs7OztvQ0FHdUI7QUFDckIsYUFBTyxJQUFQLENBQVksS0FBWixDQUFrQixlQUFsQixDQUFrQyxHQUFsQyxFQUF1QyxNQUF2QyxFQUErQyxZQUFNO0FBQ25ELGlCQUFTLG9CQUFULENBQThCLFFBQTlCLEVBQXdDLENBQXhDLEVBQTJDLEtBQTNDLEdBQW1ELGFBQW5EO0FBQ0QsT0FGRDtBQUdEOztBQUVEOzs7Ozs7bUNBR3NCO0FBQ3BCLFVBQUksQ0FBQyxVQUFVLGFBQWYsRUFBOEI7QUFDNUIsZUFBTyxRQUFRLE9BQVIsRUFBUDtBQUNELE9BRkQsTUFFTztBQUNMLGVBQU8sY0FBSSxJQUFKLENBQVMsYUFBVCxFQUF3QixDQUF4QixFQUEyQixVQUFDLFNBQUQsRUFBZTtBQUMvQyxvQkFBVSxpQkFBVixDQUE0QixhQUE1QixFQUEyQyxFQUFFLFNBQVMsSUFBWCxFQUEzQztBQUNBLGNBQUksY0FBYyxVQUFVLGlCQUFWLENBQTRCLFNBQTVCLEVBQXVDLEVBQUUsU0FB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QUFELEVBQVEsV0FBUixFQUF3QjtBQUNoSCxRQUFJLEtBQUosRUFBVztBQUFFO0FBQ1gsY0FBUSxLQUFSLENBQWMsS0FBZDtBQUNELEtBRkQsTUFFTztBQUNMLHVCQUFpQixXQUFqQjtBQUNBLDBCQUFvQixXQUFwQjtBQUNEO0FBQ0YsR0FQRDtBQVFELENBckJEOzs7QUNqTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKCl7ZnVuY3Rpb24gcihlLG4sdCl7ZnVuY3Rpb24gbyhpLGYpe2lmKCFuW2ldKXtpZighZVtpXSl7dmFyIGM9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZTtpZighZiYmYylyZXR1cm4gYyhpLCEwKTtpZih1KXJldHVybiB1KGksITApO3ZhciBhPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIraStcIidcIik7dGhyb3cgYS5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGF9dmFyIHA9bltpXT17ZXhwb3J0czp7fX07ZVtpXVswXS5jYWxsKHAuZXhwb3J0cyxmdW5jdGlvbihyKXt2YXIgbj1lW2ldWzFdW3JdO3JldHVybiBvKG58fHIpfSxwLHAuZXhwb3J0cyxyLGUsbix0KX1yZXR1cm4gbltpXS5leHBvcnRzfWZvcih2YXIgdT1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlLGk9MDtpPHQubGVuZ3RoO2krKylvKHRbaV0pO3JldHVybiBvfXJldHVybiByfSkoKSIsIid1c2Ugc3RyaWN0JztcclxuXHJcbmltcG9ydCBpZGIgZnJvbSAnaWRiJztcclxuXHJcbi8qKlxyXG4gKiBDb21tb24gZGF0YWJhc2UgaGVscGVyIGZ1bmN0aW9ucy5cclxuICovXHJcblxyXG5jbGFzcyBEQkhlbHBlciB7XHJcbiAgLyoqXHJcbiAgICogRGF0YWJhc2UgVVJMLlxyXG4gICAqIENoYW5nZSB0aGlzIHRvIHJlc3RhdXJhbnRzLmpzb24gZmlsZSBsb2NhdGlvbiBvbiB5b3VyIHNlcnZlci5cclxuICAgKi9cclxuICBzdGF0aWMgZ2V0IERBVEFCQVNFX1VSTCgpIHtcclxuICAgIC8vY29uc3QgcG9ydCA9IDEzMzc7Ly8gQ2hhbmdlIHRoaXMgdG8geW91ciBzZXJ2ZXIgcG9ydFxyXG4gICAgLy9yZXR1cm4gYGh0dHBzOi8vcmVzdGF1cmFudC1yZXZpZXdzLWFwaS5oZXJva3VhcHAuY29tLzoke3BvcnR9YDtcclxuICAgIHJldHVybiAnaHR0cHM6Ly9yZXN0YXVyYW50LXJldmlld3MtYXBpLmhlcm9rdWFwcC5jb20nO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQE1hcCBtYXJrZXIgZm9yIGEgcmVzdGF1cmFudC5cclxuICAgKi9cclxuICBzdGF0aWMgbWFwTWFya2VyRm9yUmVzdGF1cmFudChyZXN0YXVyYW50LCBtYXApIHtcclxuICAgIERCSGVscGVyLmFkZFRpdGxlVG9NYXAoKTtcclxuICAgIGNvbnN0IG1hcmtlciA9IG5ldyBnb29nbGUubWFwcy5NYXJrZXIoe1xyXG4gICAgICBwb3NpdGlvbjogcmVzdGF1cmFudC5sYXRsbmcsXHJcbiAgICAgIHRpdGxlOiByZXN0YXVyYW50Lm5hbWUsXHJcbiAgICAgIHVybDogREJIZWxwZXIudXJsRm9yUmVzdGF1cmFudChyZXN0YXVyYW50KSxcclxuICAgICAgbWFwOiBtYXAsXHJcbiAgICAgIGFuaW1hdGlvbjogZ29vZ2xlLm1hcHMuQW5pbWF0aW9uLkRST1BcclxuICAgIH0pO1xyXG4gICAgcmV0dXJuIG1hcmtlcjtcclxuICB9XHJcbiAgLyoqXHJcbiAgICogQGFkZCBhdHRyaWJ1dGUgdGl0bGUgdG8gPGlmcmFtZT4gaW4gR29vZ2xlIE1hcCB0byBpbXByb3ZlIHRoZSBhY2Nlc3NpYmlsaXR5XHJcbiAgICovXHJcbiAgc3RhdGljIGFkZFRpdGxlVG9NYXAoKSB7XHJcbiAgICBnb29nbGUubWFwcy5ldmVudC5hZGRMaXN0ZW5lck9uY2UobWFwLCAnaWRsZScsICgpID0+IHtcclxuICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2lmcmFtZScpWzBdLnRpdGxlID0gJ0dvb2dsZSBNYXBzJztcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQG9wZW4gZGF0YWJhc2UgdG8gc3RvcmUgZGF0YSByZXRyaWV2ZWQgZnJvbSB0aGUgc2VydmVyIGluIGluZGV4ZWREQiBBUElcclxuICAgKi9cclxuICBzdGF0aWMgb3BlbkRhdGFiYXNlKCkge1xyXG4gICAgaWYgKCFuYXZpZ2F0b3Iuc2VydmljZVdvcmtlcikge1xyXG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICByZXR1cm4gaWRiLm9wZW4oJ3Jlc3RhdXJhbnRzJywgMywgKHVwZ3JhZGVEYikgPT4ge1xyXG4gICAgICAgIHVwZ3JhZGVEYi5jcmVhdGVPYmplY3RTdG9yZSgncmVzdGF1cmFudHMnLCB7IGtleVBhdGg6ICdpZCcgfSk7XHJcbiAgICAgICAgbGV0IHJldmlld1N0b3JlID0gdXBncmFkZURiLmNyZWF0ZU9iamVjdFN0b3JlKCdyZXZpZXdzJywgeyBrZXlQYXRoOiAnaWQnIH0pO1xyXG4gICAgICAgIHJldmlld1N0b3JlLmNyZWF0ZUluZGV4KCdyZXN0YXVyYW50X2lkJywgJ3Jlc3RhdXJhbnRfaWQnLCB7IHVuaXF1ZTogZmFsc2UgfSk7XHJcbiAgICAgICAgdXBncmFkZURiLmNyZWF0ZU9iamVjdFN0b3JlKCdvZmZsaW5lLXJldmlld3MnLCB7IGtleVBhdGg6ICd1cGRhdGVkQXQnIH0pO1xyXG4gICAgICB9KTtcclxuICAgIH1cclxuICB9XHJcbiAgLyoqXHJcbiAgICogQGdldCBkYXRhIGZyb20gYSBzdG9yZSBpbiBJbmRleGVkREIgaWYgaXQgaXMgYXZhaWxhYmxlXHJcbiAgICovXHJcbiAgc3RhdGljIGdldENhY2hlZEluZGV4ZWREQihzdG9yZV9uYW1lKSB7XHJcbiAgICBsZXQgZGJQcm9taXNlID0gREJIZWxwZXIub3BlbkRhdGFiYXNlKCk7XHJcblxyXG4gICAgcmV0dXJuIGRiUHJvbWlzZS50aGVuKGZ1bmN0aW9uKGRiKSB7XHJcbiAgICAgIGlmKCFkYikgcmV0dXJuO1xyXG4gICAgICBsZXQgdHggPSBkYi50cmFuc2FjdGlvbihzdG9yZV9uYW1lKTtcclxuICAgICAgbGV0IHN0b3JlID0gdHgub2JqZWN0U3RvcmUoc3RvcmVfbmFtZSk7XHJcbiAgICAgIHJldHVybiBzdG9yZS5nZXRBbGwoKTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQHN0b3JlIHRoZSBkYXRhIGluIEluZGV4ZWREQiBhZnRlciBmZXRjaGluZyBpdCBmcm9tIHRoZSBzZXJ2ZXJcclxuICAgKiBAcGFyYW0gZGF0YXM6IGFyZSByZXRyaWV2ZWQgZnJvbSB0aGUgc2VydmVyLCBzdG9yZV9uYW1lOiB7c3RyaW5nfVxyXG4gICAqL1xyXG4gIHN0YXRpYyBzdG9yZURhdGFJbmRleGVkRGIoZGF0YXMsIHN0b3JlX25hbWUpIHtcclxuICAgIGxldCBkYlByb21pc2UgPSBEQkhlbHBlci5vcGVuRGF0YWJhc2UoKTtcclxuXHJcbiAgICBkYlByb21pc2UudGhlbihkYiA9PiB7XHJcbiAgICAgIGlmICghZGIpIHJldHVybjtcclxuICAgICAgY29uc3QgdHggPSBkYi50cmFuc2FjdGlvbihzdG9yZV9uYW1lLCAncmVhZHdyaXRlJyk7XHJcbiAgICAgIGNvbnN0IHN0b3JlID0gdHgub2JqZWN0U3RvcmUoc3RvcmVfbmFtZSk7XHJcblxyXG4gICAgICBkYXRhcy5mb3JFYWNoKGRhdGEgPT4ge1xyXG4gICAgICAgIHN0b3JlLnB1dChkYXRhKTtcclxuICAgICAgfSk7XHJcbiAgICAgIHJldHVybiB0eC5jb21wbGV0ZTtcclxuICAgIH0pO1xyXG4gIH1cclxuICAvKipcclxuICAgKiBAZmV0Y2ggYWxsIHJlc3RhdXJhbnRzIGZvcm0gSW5kZXhlZERCIGlmIHRoZXkgZXhpc3Qgb3RoZXJ3aXNlIGZldGNoIGZyb20gdGhlIHNlcnZlci5cclxuICAgKi9cclxuICBzdGF0aWMgZmV0Y2hSZXN0YXVyYW50cyhjYWxsYmFjaykge1xyXG4gICAgLy9jaGVjayBpZiBkYXRhIGV4aXN0cyBpbiBpbmRleERCIEFQSSBpZiBpdCBkb2VzIHJldHVybiBjYWxsYmFja1xyXG4gICAgREJIZWxwZXIuZ2V0Q2FjaGVkSW5kZXhlZERCKCdyZXN0YXVyYW50cycpLnRoZW4ocmVzdWx0cyA9PiB7XHJcbiAgICAgIGlmIChyZXN1bHRzICYmIHJlc3VsdHMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHJlc3VsdHMpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIC8vIFVzZSBlbHNlIGNvbmRpdGlvbiB0byBhdm9pZCBmZXRjaGluZyBmcm9tIHNhaWxzIHNlcnZlclxyXG4gICAgICAgIC8vIGJlY2F1c2UgdXBkYXRpbmcgZmF2b3JpdGUgb24gdGhlIHNhaWxzIHNlcnZlciBpcyBub3QgcGVyc2lzdGVudFxyXG4gICAgICAgIC8vIGFuZCB0byBnZXQgZGF0YSBmcm9tIEluZGV4ZWREQiBvbmx5XHJcbiAgICAgICAgZmV0Y2goYCR7REJIZWxwZXIuREFUQUJBU0VfVVJMfS9yZXN0YXVyYW50c2ApXHJcbiAgICAgICAgICAudGhlbihyZXNwb25zZSA9PiByZXNwb25zZS5qc29uKCkpXHJcbiAgICAgICAgICAudGhlbihyZXN0YXVyYW50cyA9PiB7XHJcbiAgICAgICAgICAgIC8vc3RvcmUgZGF0YSBpbiBpbmRleERCIEFQSSBhZnRlciBmZXRjaGluZ1xyXG4gICAgICAgICAgICBEQkhlbHBlci5zdG9yZURhdGFJbmRleGVkRGIocmVzdGF1cmFudHMsICdyZXN0YXVyYW50cycpO1xyXG4gICAgICAgICAgICByZXR1cm4gY2FsbGJhY2sobnVsbCwgcmVzdGF1cmFudHMpO1xyXG4gICAgICAgICAgfSlcclxuICAgICAgICAgIC5jYXRjaChlcnIgPT4ge1xyXG4gICAgICAgICAgICByZXR1cm4gY2FsbGJhY2soZXJyICwgbnVsbCk7XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgfVxyXG4gIC8qKlxyXG4gICAqIEBmZXRjaCBhbGwgcmV2aWV3cyBmb3JtIEluZGV4ZWREQiBpZiB0aGV5IGV4aXN0IG90aGVyd2lzZSBmZXRjaCBmcm9tIHRoZSBzZXJ2ZXIuXHJcbiAgICovXHJcbiAgc3RhdGljIGZldGNoUmVzdGF1cmFudFJldmlld3MocmVzdGF1cmFudCwgY2FsbGJhY2spIHtcclxuICAgIGxldCBkYlByb21pc2UgPSBEQkhlbHBlci5vcGVuRGF0YWJhc2UoKTtcclxuXHJcbiAgICBkYlByb21pc2UudGhlbihkYiA9PiB7XHJcbiAgICAgIGlmICghZGIpIHJldHVybjtcclxuXHJcbiAgICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oJ3Jldmlld3MnKTtcclxuICAgICAgY29uc3Qgc3RvcmUgPSB0eC5vYmplY3RTdG9yZSgncmV2aWV3cycpO1xyXG4gICAgICBjb25zdCBpbmRleCA9IHN0b3JlLmluZGV4KCdyZXN0YXVyYW50X2lkJyk7XHJcblxyXG4gICAgICBpbmRleC5nZXRBbGwocmVzdGF1cmFudC5pZCkudGhlbihyZXN1bHRzID0+IHtcclxuICAgICAgICBjYWxsYmFjayhudWxsLCByZXN1bHRzKTtcclxuXHJcbiAgICAgICAgaWYgKCFuYXZpZ2F0b3Iub25MaW5lKSB7XHJcbiAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBmZXRjaChgJHtEQkhlbHBlci5EQVRBQkFTRV9VUkx9L3Jldmlld3MvP3Jlc3RhdXJhbnRfaWQ9JHtyZXN0YXVyYW50LmlkfWApXHJcbiAgICAgICAgICAudGhlbihyZXNwb25zZSA9PiB7XHJcbiAgICAgICAgICAgIHJldHVybiByZXNwb25zZS5qc29uKCk7XHJcbiAgICAgICAgICB9KVxyXG4gICAgICAgICAgLnRoZW4ocmV2aWV3cyA9PiB7XHJcbiAgICAgICAgICAgIC8vc3RvcmUgZGF0YSBpbiBpbmRleERCIEFQSSBhZnRlciBmZXRjaGluZ1xyXG4gICAgICAgICAgICBsZXQgcmV2aWV3c0xlbiA9IHJldmlld3MubGVuZ3RoO1xyXG4gICAgICAgICAgICBpZiAocmV2aWV3c0xlbiA+PSAyOSkge1xyXG4gICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcmV2aWV3c0xlbiAtIDIwOyBpKyspIHtcclxuICAgICAgICAgICAgICAgIERCSGVscGVyLmRlbGV0ZVJlc3RhdXJhbnRSZXZpZXdzKHJldmlld3NbaV0uaWQpO1xyXG4gICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBEQkhlbHBlci5zdG9yZURhdGFJbmRleGVkRGIocmV2aWV3cywgJ3Jldmlld3MnKTtcclxuICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgcmV2aWV3cyk7XHJcbiAgICAgICAgICB9KVxyXG4gICAgICAgICAgLmNhdGNoKGVyciA9PiB7XHJcbiAgICAgICAgICAgIGNhbGxiYWNrKGVyciAsIG51bGwpO1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBAZmV0Y2ggYSByZXN0YXVyYW50IGJ5IGl0cyBJRC5cclxuICAgKi9cclxuICBzdGF0aWMgZmV0Y2hSZXN0YXVyYW50QnlJZChpZCwgY2FsbGJhY2spIHtcclxuICAgIC8vIGZldGNoIGFsbCByZXN0YXVyYW50cyB3aXRoIHByb3BlciBlcnJvciBoYW5kbGluZy5cclxuICAgIERCSGVscGVyLmZldGNoUmVzdGF1cmFudHMoKGVycm9yLCByZXN0YXVyYW50cykgPT4ge1xyXG4gICAgICBpZiAoZXJyb3IpIHtcclxuICAgICAgICBjYWxsYmFjayhlcnJvciwgbnVsbCk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgY29uc3QgcmVzdGF1cmFudCA9IHJlc3RhdXJhbnRzLmZpbmQociA9PiByLmlkID09IGlkKTtcclxuICAgICAgICBpZiAocmVzdGF1cmFudCkgeyAvLyBHb3QgdGhlIHJlc3RhdXJhbnRcclxuICAgICAgICAgIGNhbGxiYWNrKG51bGwsIHJlc3RhdXJhbnQpO1xyXG4gICAgICAgIH0gZWxzZSB7IC8vIFJlc3RhdXJhbnQgZG9lcyBub3QgZXhpc3QgaW4gdGhlIGRhdGFiYXNlXHJcbiAgICAgICAgICBjYWxsYmFjaygnUmVzdGF1cmFudCBkb2VzIG5vdCBleGlzdCcsIG51bGwpO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBAZmV0Y2ggcmVzdGF1cmFudHMgYnkgYSBjdWlzaW5lIHR5cGUgd2l0aCBwcm9wZXIgZXJyb3IgaGFuZGxpbmcuXHJcbiAgICovXHJcbiAgc3RhdGljIGZldGNoUmVzdGF1cmFudEJ5Q3Vpc2luZShjdWlzaW5lLCBjYWxsYmFjaykge1xyXG4gICAgLy8gRmV0Y2ggYWxsIHJlc3RhdXJhbnRzICB3aXRoIHByb3BlciBlcnJvciBoYW5kbGluZ1xyXG4gICAgREJIZWxwZXIuZmV0Y2hSZXN0YXVyYW50cygoZXJyb3IsIHJlc3RhdXJhbnRzKSA9PiB7XHJcbiAgICAgIGlmIChlcnJvcikge1xyXG4gICAgICAgIGNhbGxiYWNrKGVycm9yLCBudWxsKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICAvLyBGaWx0ZXIgcmVzdGF1cmFudHMgdG8gaGF2ZSBvbmx5IGdpdmVuIGN1aXNpbmUgdHlwZVxyXG4gICAgICAgIGNvbnN0IHJlc3VsdHMgPSByZXN0YXVyYW50cy5maWx0ZXIociA9PiByLmN1aXNpbmVfdHlwZSA9PSBjdWlzaW5lKTtcclxuICAgICAgICBjYWxsYmFjayhudWxsLCByZXN1bHRzKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBAZmV0Y2ggcmVzdGF1cmFudHMgYnkgYSBuZWlnaGJvcmhvb2Qgd2l0aCBwcm9wZXIgZXJyb3IgaGFuZGxpbmcuXHJcbiAgICovXHJcbiAgc3RhdGljIGZldGNoUmVzdGF1cmFudEJ5TmVpZ2hib3Job29kKG5laWdoYm9yaG9vZCwgY2FsbGJhY2spIHtcclxuICAgIC8vIEZldGNoIGFsbCByZXN0YXVyYW50c1xyXG4gICAgREJIZWxwZXIuZmV0Y2hSZXN0YXVyYW50cygoZXJyb3IsIHJlc3RhdXJhbnRzKSA9PiB7XHJcbiAgICAgIGlmIChlcnJvcikge1xyXG4gICAgICAgIGNhbGxiYWNrKGVycm9yLCBudWxsKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICAvLyBGaWx0ZXIgcmVzdGF1cmFudHMgdG8gaGF2ZSBvbmx5IGdpdmVuIG5laWdoYm9yaG9vZFxyXG4gICAgICAgIGNvbnN0IHJlc3VsdHMgPSByZXN0YXVyYW50cy5maWx0ZXIociA9PiByLm5laWdoYm9yaG9vZCA9PSBuZWlnaGJvcmhvb2QpO1xyXG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHJlc3VsdHMpO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEBmZXRjaCByZXN0YXVyYW50cyBieSBhIGN1aXNpbmUgYW5kIGEgbmVpZ2hib3Job29kIHdpdGggcHJvcGVyIGVycm9yIGhhbmRsaW5nLlxyXG4gICAqL1xyXG4gIHN0YXRpYyBmZXRjaFJlc3RhdXJhbnRCeUN1aXNpbmVBbmROZWlnaGJvcmhvb2QoY3Vpc2luZSwgbmVpZ2hib3Job29kLCBjYWxsYmFjaykge1xyXG4gICAgLy8gRmV0Y2ggYWxsIHJlc3RhdXJhbnRzXHJcbiAgICBEQkhlbHBlci5mZXRjaFJlc3RhdXJhbnRzKChlcnJvciwgcmVzdGF1cmFudHMpID0+IHtcclxuICAgICAgaWYgKGVycm9yKSB7XHJcbiAgICAgICAgY2FsbGJhY2soZXJyb3IsIG51bGwpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGxldCByZXN1bHRzID0gcmVzdGF1cmFudHM7XHJcbiAgICAgICAgaWYgKGN1aXNpbmUgIT0gJ2FsbCcpIHsgLy8gZmlsdGVyIGJ5IGN1aXNpbmVcclxuICAgICAgICAgIHJlc3VsdHMgPSByZXN1bHRzLmZpbHRlcihyID0+IHIuY3Vpc2luZV90eXBlID09IGN1aXNpbmUpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAobmVpZ2hib3Job29kICE9ICdhbGwnKSB7IC8vIGZpbHRlciBieSBuZWlnaGJvcmhvb2RcclxuICAgICAgICAgIHJlc3VsdHMgPSByZXN1bHRzLmZpbHRlcihyID0+IHIubmVpZ2hib3Job29kID09IG5laWdoYm9yaG9vZCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHJlc3VsdHMpO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHN0YXRpYyBmZXRjaFJlc3RhdXJhbnRCeUN1aXNpbmVOZWlnaGJvcmhvb2RBbmRGYXZvcml0ZShjdWlzaW5lLCBuZWlnaGJvcmhvb2QsIGZhdm9yaXRlLCBjYWxsYmFjaykge1xyXG4gICAgLy8gRmV0Y2ggYWxsIHJlc3RhdXJhbnRzXHJcbiAgICBEQkhlbHBlci5mZXRjaFJlc3RhdXJhbnRzKChlcnJvciwgcmVzdGF1cmFudHMpID0+IHtcclxuICAgICAgaWYgKGVycm9yKSB7XHJcbiAgICAgICAgY2FsbGJhY2soZXJyb3IsIG51bGwpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGxldCByZXN1bHRzID0gcmVzdGF1cmFudHM7XHJcbiAgICAgICAgaWYgKGN1aXNpbmUgIT0gJ2FsbCcpIHsgLy8gZmlsdGVyIGJ5IGN1aXNpbmVcclxuICAgICAgICAgIHJlc3VsdHMgPSByZXN1bHRzLmZpbHRlcihyID0+IHIuY3Vpc2luZV90eXBlID09IGN1aXNpbmUpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAobmVpZ2hib3Job29kICE9ICdhbGwnKSB7IC8vIGZpbHRlciBieSBuZWlnaGJvcmhvb2RcclxuICAgICAgICAgIHJlc3VsdHMgPSByZXN1bHRzLmZpbHRlcihyID0+IHIubmVpZ2hib3Job29kID09IG5laWdoYm9yaG9vZCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChmYXZvcml0ZSA9PSAndHJ1ZScpIHtcclxuICAgICAgICAgIHJlc3VsdHMgPSByZXN1bHRzLmZpbHRlcihyID0+IHIuaXNfZmF2b3JpdGUgPT0gJ3RydWUnKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgY2FsbGJhY2sobnVsbCwgcmVzdWx0cyk7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQGZldGNoIGFsbCBuZWlnaGJvcmhvb2RzIHdpdGggcHJvcGVyIGVycm9yIGhhbmRsaW5nLlxyXG4gICAqL1xyXG4gIHN0YXRpYyBmZXRjaE5laWdoYm9yaG9vZHMoY2FsbGJhY2spIHtcclxuICAgIC8vIEZldGNoIGFsbCByZXN0YXVyYW50c1xyXG4gICAgREJIZWxwZXIuZmV0Y2hSZXN0YXVyYW50cygoZXJyb3IsIHJlc3RhdXJhbnRzKSA9PiB7XHJcbiAgICAgIGlmIChlcnJvcikge1xyXG4gICAgICAgIGNhbGxiYWNrKGVycm9yLCBudWxsKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICAvLyBHZXQgYWxsIG5laWdoYm9yaG9vZHMgZnJvbSBhbGwgcmVzdGF1cmFudHNcclxuICAgICAgICBjb25zdCBuZWlnaGJvcmhvb2RzID0gcmVzdGF1cmFudHMubWFwKCh2LCBpKSA9PiByZXN0YXVyYW50c1tpXS5uZWlnaGJvcmhvb2QpO1xyXG4gICAgICAgIC8vIFJlbW92ZSBkdXBsaWNhdGVzIGZyb20gbmVpZ2hib3Job29kc1xyXG4gICAgICAgIGNvbnN0IHVuaXF1ZU5laWdoYm9yaG9vZHMgPSBuZWlnaGJvcmhvb2RzLmZpbHRlcigodiwgaSkgPT4gbmVpZ2hib3Job29kcy5pbmRleE9mKHYpID09IGkpO1xyXG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHVuaXF1ZU5laWdoYm9yaG9vZHMpO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEBmZXRjaCBhbGwgY3Vpc2luZXMgd2l0aCBwcm9wZXIgZXJyb3IgaGFuZGxpbmcuXHJcbiAgICovXHJcbiAgc3RhdGljIGZldGNoQ3Vpc2luZXMoY2FsbGJhY2spIHtcclxuICAgIC8vIEZldGNoIGFsbCByZXN0YXVyYW50c1xyXG4gICAgREJIZWxwZXIuZmV0Y2hSZXN0YXVyYW50cygoZXJyb3IsIHJlc3RhdXJhbnRzKSA9PiB7XHJcbiAgICAgIGlmIChlcnJvcikge1xyXG4gICAgICAgIGNhbGxiYWNrKGVycm9yLCBudWxsKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICAvLyBHZXQgYWxsIGN1aXNpbmVzIGZyb20gYWxsIHJlc3RhdXJhbnRzXHJcbiAgICAgICAgY29uc3QgY3Vpc2luZXMgPSByZXN0YXVyYW50cy5tYXAoKHYsIGkpID0+IHJlc3RhdXJhbnRzW2ldLmN1aXNpbmVfdHlwZSk7XHJcbiAgICAgICAgLy8gUmVtb3ZlIGR1cGxpY2F0ZXMgZnJvbSBjdWlzaW5lc1xyXG4gICAgICAgIGNvbnN0IHVuaXF1ZUN1aXNpbmVzID0gY3Vpc2luZXMuZmlsdGVyKCh2LCBpKSA9PiBjdWlzaW5lcy5pbmRleE9mKHYpID09IGkpO1xyXG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHVuaXF1ZUN1aXNpbmVzKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBAcmVzdGF1cmFudCBwYWdlIFVSTC5cclxuICAgKi9cclxuICBzdGF0aWMgdXJsRm9yUmVzdGF1cmFudChyZXN0YXVyYW50KSB7XHJcbiAgICByZXR1cm4gKGAuL3Jlc3RhdXJhbnQuaHRtbD9pZD0ke3Jlc3RhdXJhbnQuaWR9YCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBAcmVzdGF1cmFudCBpbWFnZSBVUkwuXHJcbiAgICovXHJcbiAgc3RhdGljIGltYWdlVXJsRm9yUmVzdGF1cmFudChyZXN0YXVyYW50KSB7XHJcbiAgICBpZiAocmVzdGF1cmFudC5waG90b2dyYXBoID09PSB1bmRlZmluZWQpIHtcclxuICAgICAgcmVzdGF1cmFudC5waG90b2dyYXBoID0gMTA7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gKGAvaW1nLyR7cmVzdGF1cmFudC5waG90b2dyYXBofS53ZWJwYCk7XHJcbiAgfVxyXG5cclxuICBzdGF0aWMgZGVsZXRlUmVzdGF1cmFudFJldmlld3MocmV2aWV3X2lkKSB7XHJcbiAgICBmZXRjaChgJHtEQkhlbHBlci5EQVRBQkFTRV9VUkx9L3Jldmlld3MvJHtyZXZpZXdfaWR9YCwge1xyXG4gICAgICBtZXRob2Q6ICdERUxFVEUnXHJcbiAgICB9KVxyXG4gICAgICAudGhlbihyZXNwb25zZSA9PiB7XHJcbiAgICAgICAgcmV0dXJuIHJlc3BvbnNlO1xyXG4gICAgICB9KVxyXG4gICAgICAudGhlbihkYXRhID0+IHtcclxuICAgICAgICByZXR1cm4gZGF0YTtcclxuICAgICAgfSlcclxuICAgICAgLmNhdGNoKGVyciA9PiB7XHJcbiAgICAgICAgY29uc29sZS5sb2coJ0Vycm9yJywgZXJyKTtcclxuICAgICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBAcG9zdCByZXZpZXdfZGF0YSB0byB0aGUgc2VydmVyIHdoZW4gYSB1c2VyIHN1Ym1pdHMgYSByZXZpZXdcclxuICAgKiBvbmxpbmU6IGtlZXAgaXQgaW4gdGhlIHJldmlld3Mgc3RvcmUgaW4gSW5kZXhlZERCXHJcbiAgICogb2ZmbGluZToga2VlcCBpdCBpbiB0aGUgb2ZmbG5lLXJldmlld3MgaW4gSW5kZXhlZERCXHJcbiAgICogQHBhcmFtIHJldmlld19kYXRhIGlzIGZyb20gYSB1c2VyIGZpbGxzIG91dCB0aGUgZm9ybVxyXG4gICAqL1xyXG4gIHN0YXRpYyBjcmVhdGVSZXN0YXVyYW50UmV2aWV3KHJldmlld19kYXRhKSB7XHJcbiAgICByZXR1cm4gZmV0Y2goYCR7REJIZWxwZXIuREFUQUJBU0VfVVJMfS9yZXZpZXdzYCwge1xyXG4gICAgICBtZXRob2Q6ICdQT1NUJyxcclxuICAgICAgY2FjaGU6ICduby1jYWNoZScsIC8vICpkZWZhdWx0LCBuby1jYWNoZSwgcmVsb2FkLCBmb3JjZS1jYWNoZSwgb25seS1pZi1jYWNoZWRcclxuICAgICAgY3JlZGVudGlhbHM6ICdzYW1lLW9yaWdpbicsXHJcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHJldmlld19kYXRhKSxcclxuICAgICAgaGVhZGVyczoge1xyXG4gICAgICAgICdjb250ZW50LXR5cGUnOiAnYXBwbGljYXRpb24vanNvbidcclxuICAgICAgfSxcclxuICAgICAgbW9kZTogJ2NvcnMnLFxyXG4gICAgICByZWRpcmVjdDogJ2ZvbGxvdycsXHJcbiAgICAgIHJlZmVycmVyOiAnbm8tcmVmZXJyZXInLFxyXG4gICAgfSlcclxuICAgICAgLnRoZW4ocmVzcG9uc2UgPT4ge1xyXG4gICAgICAgIHJlc3BvbnNlLmpzb24oKVxyXG4gICAgICAgICAgLnRoZW4ocmV2aWV3X2RhdGEgPT4ge1xyXG4gICAgICAgICAgLyoga2VlcCBkYXRhcyBpbiBJbmRleGVkREIgYWZ0ZXIgcG9zdGluZyBkYXRhIHRvIHRoZSBzZXJ2ZXIgd2hlbiBvbmxpbmUgKi9cclxuICAgICAgICAgICAgREJIZWxwZXIuc3RvcmVEYXRhSW5kZXhlZERiKFtyZXZpZXdfZGF0YV0sICdyZXZpZXdzJyk7XHJcbiAgICAgICAgICAgIHJldHVybiByZXZpZXdfZGF0YTtcclxuICAgICAgICAgIH0pO1xyXG4gICAgICB9KVxyXG4gICAgICAuY2F0Y2goZXJyb3IgPT4ge1xyXG4gICAgICAgIHJldmlld19kYXRhWyd1cGRhdGVkQXQnXSA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xyXG4gICAgICAgIC8qIGtlZXAgZGF0YXMgaW4gSW5kZXhlZERCIGFmdGVyIHBvc3RpbmcgZGF0YSB0byB0aGUgc2VydmVyIHdoZW4gb2ZmbGluZSovXHJcbiAgICAgICAgREJIZWxwZXIuc3RvcmVEYXRhSW5kZXhlZERiKFtyZXZpZXdfZGF0YV0sICdvZmZsaW5lLXJldmlld3MnKTtcclxuICAgICAgICBjb25zb2xlLmxvZygnUmV2aWV3IHN0b3JlZCBvZmZsaW5lIGluIElEQicpO1xyXG4gICAgICAgIHJldHVybjtcclxuICAgICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBAY2xlYXIgZGF0YSBpbiB0aGUgb2ZmbGluZS1yZXZpZXdzIHN0b3JlXHJcbiAgICovXHJcbiAgc3RhdGljIGNsZWFyT2ZmbGluZVJldmlld3MoKSB7XHJcbiAgICBsZXQgZGJQcm9taXNlID0gREJIZWxwZXIub3BlbkRhdGFiYXNlKCk7XHJcbiAgICBkYlByb21pc2UudGhlbihkYiA9PiB7XHJcbiAgICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oJ29mZmxpbmUtcmV2aWV3cycsICdyZWFkd3JpdGUnKTtcclxuICAgICAgY29uc3Qgc3RvcmUgPSB0eC5vYmplY3RTdG9yZSgnb2ZmbGluZS1yZXZpZXdzJyk7XHJcbiAgICAgIHN0b3JlLmNsZWFyKCk7XHJcbiAgICB9KTtcclxuICAgIHJldHVybjtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEBnZXQgcmV2aWV3cyBmcm9tIG9mZmxpbmUtc3RvcmVzIGluIEluZGV4ZWREQiB3aGVuIGEgdXNlciBnbyBmcm9tIG9mZmxpbmUgdG8gb25saW5lXHJcbiAgICovXHJcbiAgc3RhdGljIGNyZWF0ZU9mZmxpbmVSZXZpZXcoKSB7XHJcbiAgICBEQkhlbHBlci5vcGVuRGF0YWJhc2UoKS50aGVuKGRiID0+IHtcclxuICAgICAgaWYgKCFkYikgcmV0dXJuO1xyXG4gICAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKCdvZmZsaW5lLXJldmlld3MnLCAncmVhZHdyaXRlJyk7XHJcbiAgICAgIGNvbnN0IHN0b3JlID0gdHgub2JqZWN0U3RvcmUoJ29mZmxpbmUtcmV2aWV3cycpO1xyXG5cclxuICAgICAgc3RvcmUuZ2V0QWxsKCkudGhlbihvZmZsaW5lUmV2aWV3cyA9PiB7XHJcbiAgICAgICAgb2ZmbGluZVJldmlld3MuZm9yRWFjaChyZXZpZXcgPT4ge1xyXG4gICAgICAgICAgREJIZWxwZXIuY3JlYXRlUmVzdGF1cmFudFJldmlldyhyZXZpZXcpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIERCSGVscGVyLmNsZWFyT2ZmbGluZVJldmlld3MoKTtcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcbiAgLyoqXHJcbiAgICpAd2hlbiBvbmxpbmUgdXBkYXRlIGEgdmFsdWUgb2YgYSByZXN0YXVyYW50J3MgZmF2b3JpdGUgYnkgc2VuZGluZyB0aGUgUFVUIHJlcXVlc3QgdG8gdGhlIHNlcnZlclxyXG4gICAqYW5kIHN0b3JlIHRoZSBkYXRhIHRvIEluZGV4ZWREQiBzbyBpdCBjYW4gYmUgdXNlZCB3aGVuIG9mZmxpbmVcclxuICAqL1xyXG4gIHN0YXRpYyB0b2dnbGVGYXZvcml0ZShyZXN0YXVyYW50LCBpc0Zhdm9yaXRlKSB7XHJcbiAgICByZXR1cm4gZmV0Y2goYCR7REJIZWxwZXIuREFUQUJBU0VfVVJMfS9yZXN0YXVyYW50cy8ke3Jlc3RhdXJhbnQuaWR9Lz9pc19mYXZvcml0ZT0ke2lzRmF2b3JpdGV9YCwge1xyXG4gICAgICBtZXRob2Q6ICdQVVQnLFxyXG4gICAgfSlcclxuICAgICAgLnRoZW4ocmVzcG9uc2UgPT4ge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKGB1cGRhdGVkIEFQSSByZXN0YXVyYW50OiAke3Jlc3RhdXJhbnQuaWR9IGZhdm9yaXRlIDogJHtpc0Zhdm9yaXRlfWApO1xyXG4gICAgICAgIHJldHVybiByZXNwb25zZS5qc29uKCk7XHJcbiAgICAgIH0pXHJcbiAgICAgIC50aGVuKGRhdGEgPT4ge1xyXG4gICAgICAgIERCSGVscGVyLnN0b3JlRGF0YUluZGV4ZWREYihbZGF0YV0sICdyZXN0YXVyYW50cycpO1xyXG4gICAgICAgIGNvbnNvbGUubG9nKGB1cGRhdGVkIElEQiByZXN0YXVyYW50OiAke3Jlc3RhdXJhbnQuaWR9IGZhdm9yaXRlIDogJHtpc0Zhdm9yaXRlfWApO1xyXG4gICAgICAgIHJldHVybiBkYXRhO1xyXG4gICAgICB9KVxyXG4gICAgICAuY2F0Y2goZXJyb3IgPT4ge1xyXG4gICAgICAgIC8vIGNvbnZlcnQgZnJvbSBib29sZWFuIHRvIHN0cmluZyBiZWNhdXNlIHRoZSBBUEkgdXNlcyBzdHJpbmdzICd0cnVlJyBhbmQgJ2ZhbHNlJ1xyXG4gICAgICAgIHJlc3RhdXJhbnQuaXNfZmF2b3JpdGUgPSBpc0Zhdm9yaXRlID8gJ3RydWUnIDogJ2ZhbHNlJztcclxuXHJcbiAgICAgICAgREJIZWxwZXIuc3RvcmVEYXRhSW5kZXhlZERiKFtyZXN0YXVyYW50XSwgJ3Jlc3RhdXJhbnRzJyk7XHJcbiAgICAgICAgY29uc29sZS5sb2coJ3N0b3JlIGZhdm9yaXRlIG9mZmxpbmUnKTtcclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAqIEBmaWxsIGZhdm9yaXRlcyBpbiBIVE1MIHNvIGl0IGNhbiBiZSB1c2VkIGJ5IGJvdGggbWFpbiBhbmQgcmVzdGF1cmFudCBwYWdlXHJcbiAqL1xyXG4gIHN0YXRpYyBmaWxsRmF2b3JpdGVzSFRNTChyZXN0YXVyYW50KSB7XHJcbiAgICBjb25zdCBsYWJlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2xhYmVsJyk7XHJcbiAgICBsYWJlbC5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCAnTGFiZWwgZm9yIGNoZWNraW5nIGZhdm9yaXRlJyk7XHJcbiAgICBsYWJlbC5jbGFzc05hbWUgPSAnZmF2LWNvbnRhaW5lcic7XHJcblxyXG4gICAgY29uc3QgaWNvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2knKTtcclxuICAgIGljb24uY2xhc3NOYW1lID0gJ2ZhcyBmYS1oZWFydCc7XHJcbiAgICBsYWJlbC5hcHBlbmQoaWNvbik7XHJcblxyXG4gICAgY29uc3QgaW5wdXQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpbnB1dCcpO1xyXG4gICAgaW5wdXQudHlwZSA9ICdjaGVja2JveCc7XHJcbiAgICBpbnB1dC5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCAnU2VsZWN0IGZhdm9yaXRlJyk7XHJcblxyXG4gICAgaWYgKHJlc3RhdXJhbnQuaXNfZmF2b3JpdGUgPT0gJ3RydWUnKSB7XHJcbiAgICAgIGljb24uc3R5bGUuY29sb3IgPSAnI2QzMmYyZic7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBpY29uLnN0eWxlLmNvbG9yID0gJyNhZWIwYjEnO1xyXG4gICAgfVxyXG5cclxuICAgIGlucHV0LmNoZWNrZWQgPSAocmVzdGF1cmFudC5pc19mYXZvcml0ZSAgPT0gJ3RydWUnKTtcclxuICAgIGlucHV0LmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIGV2ZW50ID0+IHtcclxuICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgaWYgKGlucHV0LmNoZWNrZWQgPT0gdHJ1ZSkge1xyXG4gICAgICAgIERCSGVscGVyLnRvZ2dsZUZhdm9yaXRlKHJlc3RhdXJhbnQsIGlucHV0LmNoZWNrZWQpO1xyXG4gICAgICAgIGljb24uc3R5bGUuY29sb3IgPSAnI2QzMmYyZic7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgREJIZWxwZXIudG9nZ2xlRmF2b3JpdGUocmVzdGF1cmFudCwgaW5wdXQuY2hlY2tlZCk7XHJcbiAgICAgICAgaWNvbi5zdHlsZS5jb2xvciA9ICcjYWViMGIxJztcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICBsYWJlbC5hcHBlbmQoaW5wdXQpO1xyXG4gICAgcmV0dXJuIGxhYmVsO1xyXG4gIH1cclxuXHJcbiAgLypAY3JlYXRlIHRoZXNlIGZ1bmN0aW9ucyB0byBhZGQgb25saW5lIHN0YXR1cyB0byB0aGUgYnJvd3NlclxyXG4gICAqIHdoZW4gaXQgaXMgb2ZmbGluZSBpdCB3aWxsIHN0b3JlIHJldmlldyBzdWJtaXNzaW9ucyBpbiBvZmZsaW5lLXJldmlld3MgSW5kZXhlZERCXHJcbiAgICogd2hlbiBjb25uZWN0aXZpdHkgaXMgcmVlc3RhYmxpc2hlZCwgaXQgd2lsbCBjYWxsIHRoZSBmdW5jdGlvbiB0byBzaG93IG5ldyByZXZpZXdzIG9uIHRoZSBwYWdlXHJcbiAgKi9cclxuICBzdGF0aWMgb25Hb09ubGluZSgpIHtcclxuICAgIGNvbnNvbGUubG9nKCdHb2luZyBvbmxpbmUnKTtcclxuICAgIERCSGVscGVyLmNyZWF0ZU9mZmxpbmVSZXZpZXcoKTtcclxuICB9XHJcblxyXG4gIHN0YXRpYyBvbkdvT2ZmbGluZSgpIHtcclxuICAgIGNvbnNvbGUubG9nKCdHb2luZyBvZmZsaW5lJyk7XHJcbiAgfVxyXG59XHJcblxyXG53aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignb25saW5lJywgREJIZWxwZXIub25Hb09ubGluZSk7XHJcbndpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdvZmZsaW5lJywgREJIZWxwZXIub25Hb09mZmxpbmUpO1xyXG5cclxuLyogQHJlZ2lzdGVyIFNlcnZpY2VXb3JrZXIgdG8gY2FjaGUgZGF0YSBmb3IgdGhlIHNpdGVcclxuICAgKiB0byBhbGxvdyBhbnkgcGFnZSB0aGF0IGhhcyBiZWVuIHZpc2l0ZWQgaXMgYWNjZXNzaWJsZSBvZmZsaW5lXHJcbiAgICovXHJcbm5hdmlnYXRvci5zZXJ2aWNlV29ya2VyLnJlZ2lzdGVyKCcuL3N3LmpzJylcclxuICAudGhlbihmdW5jdGlvbihyZWcpIHtcclxuICAvLyBSZWdpc3RyYXRpb24gd2FzIHN1Y2Nlc3NmdWxcclxuICAgIGNvbnNvbGUubG9nKCdTZXJ2aWNlV29ya2VyIHJlZ2lzdHJhdGlvbiBzdWNjZXNzZnVsIHdpdGggc2NvcGU6ICcsIHJlZy5zY29wZSk7XHJcbiAgICBpZiAoIW5hdmlnYXRvci5zZXJ2aWNlV29ya2VyLmNvbnRyb2xsZXIpIHtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgaWYgKHJlZy53YWl0aW5nKSB7XHJcbiAgICAgIF91cGRhdGVSZWFkeShyZWcud2FpdGluZyk7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIGlmIChyZWcuaW5zdGFsbGluZykge1xyXG4gICAgICBfdHJhY2tJbnN0YWxsaW5nKHJlZy5pbnN0YWxsaW5nKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIHJlZy5hZGRFdmVudExpc3RlbmVyKCd1cGRhdGVmb3VuZCcsIGZ1bmN0aW9uICgpIHtcclxuICAgICAgX3RyYWNrSW5zdGFsbGluZyhyZWcuaW5zdGFsbGluZyk7XHJcbiAgICB9KTtcclxuXHJcbiAgICB2YXIgcmVmcmVzaGluZztcclxuICAgIG5hdmlnYXRvci5zZXJ2aWNlV29ya2VyLmFkZEV2ZW50TGlzdGVuZXIoJ2NvbnRyb2xsZXJjaGFuZ2UnLCBmdW5jdGlvbiAoKSB7XHJcbiAgICAgIGlmIChyZWZyZXNoaW5nKSByZXR1cm47XHJcbiAgICAgIHJlZnJlc2hpbmcgPSB0cnVlO1xyXG4gICAgfSk7XHJcbiAgfSlcclxuICAuY2F0Y2goZnVuY3Rpb24gKCkge1xyXG4gICAgY29uc29sZS5sb2coJ1NlcnZpY2Ugd29ya2VyIHJlZ2lzdHJhdGlvbiBmYWlsZWQnKTtcclxuICB9KTtcclxuXHJcbmxldCBfdXBkYXRlUmVhZHkgPSAod29ya2VyKSA9PiB7XHJcbiAgd29ya2VyLnBvc3RNZXNzYWdlKHthY3Rpb246ICdza2lwV2FpdGluZyd9KTtcclxufTtcclxuXHJcbmxldCAgX3RyYWNrSW5zdGFsbGluZyA9ICh3b3JrZXIpID0+IHtcclxuICBsZXQgaW5kZXhDb250cm9sbGVyID0gdGhpcztcclxuICB3b3JrZXIuYWRkRXZlbnRMaXN0ZW5lcignc3RhdGVDaGFuZ2UnLCBmdW5jdGlvbigpIHtcclxuICAgIGlmICh3b3JrZXIuc3RhdGUgPT0gJ2luc3RhbGxlZCcpIHtcclxuICAgICAgaW5kZXhDb250cm9sbGVyLl91cGRhdGVSZWFkeSh3b3JrZXIpO1xyXG4gICAgfVxyXG4gIH0pO1xyXG59O1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgREJIZWxwZXI7XHJcbiIsIid1c2Ugc3RyaWN0JztcclxuXHJcbmltcG9ydCBEQkhlbHBlciBmcm9tICcuL2RiaGVscGVyJztcclxuXHJcbnZhciBtYXJrZXJzID0gW107XHJcblxyXG4vKipcclxuICogRmV0Y2ggbmVpZ2hib3Job29kcyBhbmQgY3Vpc2luZXMgYXMgc29vbiBhcyB0aGUgcGFnZSBpcyBsb2FkZWQuXHJcbiAqL1xyXG5kb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdET01Db250ZW50TG9hZGVkJywgKCkgPT4ge1xyXG4gIERCSGVscGVyLmFkZFRpdGxlVG9NYXAoKTtcclxuICBpbml0TWFwKCk7XHJcbiAgZmV0Y2hOZWlnaGJvcmhvb2RzKCk7XHJcbiAgZmV0Y2hDdWlzaW5lcygpO1xyXG59KTtcclxuXHJcbi8qKlxyXG4gKiBJbml0aWFsaXplIEdvb2dsZSBtYXAsIGNhbGxlZCBmcm9tIEhUTUwuXHJcbiAqL1xyXG5sZXQgaW5pdE1hcCA9ICgpID0+IHtcclxuICBpZiAodHlwZW9mIGdvb2dsZSAhPT0gJ3VuZGVmaW5lZCcpIHtcclxuICAgIGxldCBsb2MgPSB7XHJcbiAgICAgIGxhdDogNDAuNzIyMjE2LFxyXG4gICAgICBsbmc6IC03My45ODc1MDFcclxuICAgIH07XHJcbiAgICBzZWxmLm1hcCA9IG5ldyBnb29nbGUubWFwcy5NYXAoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ21hcCcpLCB7XHJcbiAgICAgIHpvb206IDEyLFxyXG4gICAgICBjZW50ZXI6IGxvYyxcclxuICAgICAgc2Nyb2xsd2hlZWw6IGZhbHNlXHJcbiAgICB9KTtcclxuICAgIHNlbGYudXBkYXRlUmVzdGF1cmFudHMoKTtcclxuICB9XHJcbiAgc2VsZi51cGRhdGVSZXN0YXVyYW50cygpO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIEFkZCBtYXJrZXJzIGZvciBjdXJyZW50IHJlc3RhdXJhbnRzIHRvIHRoZSBtYXAuXHJcbiAqL1xyXG5sZXQgYWRkTWFya2Vyc1RvTWFwID0gKHJlc3RhdXJhbnRzKSA9PiB7XHJcbiAgcmVzdGF1cmFudHMuZm9yRWFjaChyZXN0YXVyYW50ID0+IHtcclxuICAgIC8vIEFkZCBtYXJrZXIgdG8gdGhlIG1hcFxyXG4gICAgY29uc3QgbWFya2VyID0gREJIZWxwZXIubWFwTWFya2VyRm9yUmVzdGF1cmFudChyZXN0YXVyYW50LCBzZWxmLm1hcCk7XHJcbiAgICBnb29nbGUubWFwcy5ldmVudC5hZGRMaXN0ZW5lcihtYXJrZXIsICdjbGljaycsICgpID0+IHtcclxuICAgICAgd2luZG93LmxvY2F0aW9uLmhyZWYgPSBtYXJrZXIudXJsO1xyXG4gICAgfSk7XHJcbiAgICBtYXJrZXJzLnB1c2gobWFya2VyKTtcclxuICB9KTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBGZXRjaCBhbGwgbmVpZ2hib3Job29kcyBhbmQgc2V0IHRoZWlyIEhUTUwuXHJcbiAqL1xyXG5sZXQgZmV0Y2hOZWlnaGJvcmhvb2RzID0gKCkgPT4ge1xyXG4gIERCSGVscGVyLmZldGNoTmVpZ2hib3Job29kcygoZXJyb3IsIG5laWdoYm9yaG9vZHMpID0+IHtcclxuICAgIGlmIChlcnJvcikgeyAvLyBHb3QgYW4gZXJyb3JcclxuICAgICAgY29uc29sZS5lcnJvcihlcnJvcik7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBmaWxsTmVpZ2hib3Job29kc0hUTUwobmVpZ2hib3Job29kcyk7XHJcbiAgICB9XHJcbiAgfSk7XHJcbn07XHJcblxyXG4vKipcclxuICogU2V0IG5laWdoYm9yaG9vZHMgSFRNTC5cclxuICovXHJcbmxldCBmaWxsTmVpZ2hib3Job29kc0hUTUwgPSAobmVpZ2hib3Job29kcykgPT4ge1xyXG4gIGNvbnN0IHNlbGVjdCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCduZWlnaGJvcmhvb2RzLXNlbGVjdCcpO1xyXG4gIG5laWdoYm9yaG9vZHMuZm9yRWFjaChuZWlnaGJvcmhvb2QgPT4ge1xyXG4gICAgY29uc3Qgb3B0aW9uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnb3B0aW9uJyk7XHJcbiAgICBvcHRpb24uaW5uZXJIVE1MID0gbmVpZ2hib3Job29kO1xyXG4gICAgb3B0aW9uLnNldEF0dHJpYnV0ZSgndmFsdWUnLCBuZWlnaGJvcmhvb2QpO1xyXG4gICAgb3B0aW9uLnNldEF0dHJpYnV0ZSgncm9sZScsICdvcHRpb24nKTtcclxuICAgIHNlbGVjdC5hcHBlbmQob3B0aW9uKTtcclxuICB9KTtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBGZXRjaCBhbGwgY3Vpc2luZXMgYW5kIHNldCB0aGVpciBIVE1MLlxyXG4gKi9cclxubGV0IGZldGNoQ3Vpc2luZXMgPSAoKSA9PiB7XHJcbiAgREJIZWxwZXIuZmV0Y2hDdWlzaW5lcygoZXJyb3IsIGN1aXNpbmVzKSA9PiB7XHJcbiAgICBpZiAoZXJyb3IpIHsgLy8gR290IGFuIGVycm9yIVxyXG4gICAgICBjb25zb2xlLmVycm9yKGVycm9yKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIGZpbGxDdWlzaW5lc0hUTUwoY3Vpc2luZXMpO1xyXG4gICAgfVxyXG4gIH0pO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIFNldCBjdWlzaW5lcyBIVE1MLlxyXG4gKi9cclxubGV0IGZpbGxDdWlzaW5lc0hUTUwgPSAoY3Vpc2luZXMpID0+IHtcclxuICBjb25zdCBzZWxlY3QgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY3Vpc2luZXMtc2VsZWN0Jyk7XHJcblxyXG4gIGN1aXNpbmVzLmZvckVhY2goY3Vpc2luZSA9PiB7XHJcbiAgICBjb25zdCBvcHRpb24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdvcHRpb24nKTtcclxuICAgIG9wdGlvbi5pbm5lckhUTUwgPSBjdWlzaW5lO1xyXG4gICAgb3B0aW9uLnNldEF0dHJpYnV0ZSgndmFsdWUnLCBjdWlzaW5lKTtcclxuICAgIG9wdGlvbi5zZXRBdHRyaWJ1dGUoJ3JvbGUnLCAnb3B0aW9uJyk7XHJcbiAgICBzZWxlY3QuYXBwZW5kKG9wdGlvbik7XHJcbiAgfSk7XHJcbn07XHJcblxyXG4vKipcclxuICogQ3JlYXRlIHJlc3RhdXJhbnQgSFRNTC5cclxuICovXHJcbmxldCBjcmVhdGVSZXN0YXVyYW50SFRNTCA9IChyZXN0YXVyYW50KSA9PiB7XHJcbiAgY29uc3QgbGkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdsaScpO1xyXG5cclxuICBjb25zdCBpbWFnZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2ltZycpO1xyXG4gIGltYWdlLmNsYXNzTmFtZSA9ICdyZXN0YXVyYW50LWltZ3MnO1xyXG4gIGltYWdlLnNyYyA9IERCSGVscGVyLmltYWdlVXJsRm9yUmVzdGF1cmFudChyZXN0YXVyYW50KTtcclxuICBpbWFnZS5hbHQgPSBgJHtyZXN0YXVyYW50Lm5hbWV9IGlzICR7cmVzdGF1cmFudC5jdWlzaW5lX3R5cGV9IHJlc3RhdXJhbnRgO1xyXG4gIGxpLmFwcGVuZChpbWFnZSk7XHJcblxyXG4gIGNvbnN0IG5hbWVXcmFwID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgbmFtZVdyYXAuY2xhc3NOYW1lID0gJ25hbWUtd3JhcCc7XHJcbiAgY29uc3QgbmFtZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2gzJyk7XHJcbiAgbmFtZS5pbm5lckhUTUwgPSByZXN0YXVyYW50Lm5hbWU7XHJcbiAgbmFtZVdyYXAuYXBwZW5kKG5hbWUpO1xyXG4gIC8vaW1wb3J0IHRoZSBmaWxsRmF2b3JpdGVzSFRNTCBmcm9tIGRiaGVscGVyLmpzXHJcbiAgbmFtZVdyYXAuYXBwZW5kKERCSGVscGVyLmZpbGxGYXZvcml0ZXNIVE1MKHJlc3RhdXJhbnQpKTtcclxuICBsaS5hcHBlbmQobmFtZVdyYXApO1xyXG5cclxuICBjb25zdCBhZGRyZXNzV3JhcCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gIGFkZHJlc3NXcmFwLmNsYXNzTmFtZSA9ICdhZGRyZXNzLXdyYXAnO1xyXG4gIGNvbnN0IG5laWdoYm9yaG9vZCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3AnKTtcclxuICBuZWlnaGJvcmhvb2QuaW5uZXJIVE1MID0gcmVzdGF1cmFudC5uZWlnaGJvcmhvb2Q7XHJcbiAgYWRkcmVzc1dyYXAuYXBwZW5kKG5laWdoYm9yaG9vZCk7XHJcblxyXG4gIGNvbnN0IGFkZHJlc3MgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdwJyk7XHJcbiAgYWRkcmVzcy5pbm5lckhUTUwgPSByZXN0YXVyYW50LmFkZHJlc3M7XHJcbiAgYWRkcmVzc1dyYXAuYXBwZW5kKGFkZHJlc3MpO1xyXG4gIGxpLmFwcGVuZChhZGRyZXNzV3JhcCk7XHJcblxyXG4gIGNvbnN0IG1vcmUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdhJyk7XHJcbiAgbW9yZS5pbm5lckhUTUwgPSAnVmlldyBEZXRhaWxzJztcclxuICBtb3JlLmhyZWYgPSBEQkhlbHBlci51cmxGb3JSZXN0YXVyYW50KHJlc3RhdXJhbnQpO1xyXG4gIGxpLmFwcGVuZChtb3JlKTtcclxuXHJcbiAgcmV0dXJuIGxpO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIENsZWFyIGN1cnJlbnQgcmVzdGF1cmFudHMsIHRoZWlyIEhUTUwgYW5kIHJlbW92ZSB0aGVpciBtYXAgbWFya2Vycy5cclxuICovXHJcbmxldCByZXNldFJlc3RhdXJhbnRzID0gKHJlc3RhdXJhbnRzKSA9PiB7XHJcbiAgLy8gUmVtb3ZlIGFsbCByZXN0YXVyYW50c1xyXG4gIHJlc3RhdXJhbnRzID0gW107XHJcbiAgY29uc3QgdWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmVzdGF1cmFudHMtbGlzdCcpO1xyXG4gIHVsLmlubmVySFRNTCA9ICcnO1xyXG5cclxuICAvLyBSZW1vdmUgYWxsIG1hcCBtYXJrZXJzXHJcbiAgbWFya2Vycy5mb3JFYWNoKG0gPT4gbS5zZXRNYXAobnVsbCkpO1xyXG4gIG1hcmtlcnMgPSBbXTtcclxuICBzZWxmLnJlc3RhdXJhbnRzID0gcmVzdGF1cmFudHM7XHJcbn07XHJcblxyXG4vKipcclxuICogQ3JlYXRlIGFsbCByZXN0YXVyYW50cyBIVE1MIGFuZCBhZGQgdGhlbSB0byB0aGUgd2VicGFnZS5cclxuICovXHJcbmxldCBmaWxsUmVzdGF1cmFudHNIVE1MID0gKHJlc3RhdXJhbnRzKSA9PiB7XHJcbiAgY29uc3QgdWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmVzdGF1cmFudHMtbGlzdCcpO1xyXG5cclxuICByZXN0YXVyYW50cy5mb3JFYWNoKHJlc3RhdXJhbnQgPT4ge1xyXG4gICAgdWwuYXBwZW5kKGNyZWF0ZVJlc3RhdXJhbnRIVE1MKHJlc3RhdXJhbnQpKTtcclxuICB9KTtcclxuICBpZih0eXBlb2YgZ29vZ2xlICE9PSAndW5kZWZpbmVkJykge1xyXG4gICAgYWRkTWFya2Vyc1RvTWFwKHJlc3RhdXJhbnRzKTtcclxuICB9XHJcbn07XHJcblxyXG4vKipcclxuICogVXBkYXRlIHBhZ2UgYW5kIG1hcCBmb3IgY3VycmVudCByZXN0YXVyYW50cyBhbmQgbWFrZSBpdCBnbG9iYWwgc29cclxuICogaXQgYWxsb3dzIGluZGV4Lmh0bWwgdXNlIHRoaXMgZnVuY3Rpb24gdG8gdXBkYXRlIHRoZSBjb250ZW50XHJcbiAqL1xyXG5zZWxmLnVwZGF0ZVJlc3RhdXJhbnRzID0gKCkgPT4ge1xyXG4gIGNvbnN0IGNTZWxlY3QgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY3Vpc2luZXMtc2VsZWN0Jyk7XHJcbiAgY29uc3QgblNlbGVjdCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCduZWlnaGJvcmhvb2RzLXNlbGVjdCcpO1xyXG4gIGNvbnN0IGZTZWxlY3QgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZmF2b3JpdGVzLXNlbGVjdCcpO1xyXG5cclxuICBjb25zdCBjSW5kZXggPSBjU2VsZWN0LnNlbGVjdGVkSW5kZXg7XHJcbiAgY29uc3QgbkluZGV4ID0gblNlbGVjdC5zZWxlY3RlZEluZGV4O1xyXG4gIGNvbnN0IGZJbmRleCA9IGZTZWxlY3Quc2VsZWN0ZWRJbmRleDtcclxuXHJcbiAgY29uc3QgY3Vpc2luZSA9IGNTZWxlY3RbY0luZGV4XS52YWx1ZTtcclxuICBjb25zdCBuZWlnaGJvcmhvb2QgPSBuU2VsZWN0W25JbmRleF0udmFsdWU7XHJcbiAgY29uc3QgZmF2b3JpdGUgPSBmU2VsZWN0W2ZJbmRleF0udmFsdWU7XHJcblxyXG4gIERCSGVscGVyLmZldGNoUmVzdGF1cmFudEJ5Q3Vpc2luZU5laWdoYm9yaG9vZEFuZEZhdm9yaXRlKGN1aXNpbmUsIG5laWdoYm9yaG9vZCwgZmF2b3JpdGUsIChlcnJvciwgcmVzdGF1cmFudHMpID0+IHtcclxuICAgIGlmIChlcnJvcikgeyAvLyBHb3QgYW4gZXJyb3IhXHJcbiAgICAgIGNvbnNvbGUuZXJyb3IoZXJyb3IpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgcmVzZXRSZXN0YXVyYW50cyhyZXN0YXVyYW50cyk7XHJcbiAgICAgIGZpbGxSZXN0YXVyYW50c0hUTUwocmVzdGF1cmFudHMpO1xyXG4gICAgfVxyXG4gIH0pO1xyXG59O1xyXG5cclxuXHJcblxyXG4iLCIndXNlIHN0cmljdCc7XG5cbihmdW5jdGlvbigpIHtcbiAgZnVuY3Rpb24gdG9BcnJheShhcnIpIHtcbiAgICByZXR1cm4gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJyKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHByb21pc2lmeVJlcXVlc3QocmVxdWVzdCkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgIHJlcXVlc3Qub25zdWNjZXNzID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJlc29sdmUocmVxdWVzdC5yZXN1bHQpO1xuICAgICAgfTtcblxuICAgICAgcmVxdWVzdC5vbmVycm9yID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJlamVjdChyZXF1ZXN0LmVycm9yKTtcbiAgICAgIH07XG4gICAgfSk7XG4gIH1cblxuICBmdW5jdGlvbiBwcm9taXNpZnlSZXF1ZXN0Q2FsbChvYmosIG1ldGhvZCwgYXJncykge1xuICAgIHZhciByZXF1ZXN0O1xuICAgIHZhciBwID0gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICByZXF1ZXN0ID0gb2JqW21ldGhvZF0uYXBwbHkob2JqLCBhcmdzKTtcbiAgICAgIHByb21pc2lmeVJlcXVlc3QocmVxdWVzdCkudGhlbihyZXNvbHZlLCByZWplY3QpO1xuICAgIH0pO1xuXG4gICAgcC5yZXF1ZXN0ID0gcmVxdWVzdDtcbiAgICByZXR1cm4gcDtcbiAgfVxuXG4gIGZ1bmN0aW9uIHByb21pc2lmeUN1cnNvclJlcXVlc3RDYWxsKG9iaiwgbWV0aG9kLCBhcmdzKSB7XG4gICAgdmFyIHAgPSBwcm9taXNpZnlSZXF1ZXN0Q2FsbChvYmosIG1ldGhvZCwgYXJncyk7XG4gICAgcmV0dXJuIHAudGhlbihmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgaWYgKCF2YWx1ZSkgcmV0dXJuO1xuICAgICAgcmV0dXJuIG5ldyBDdXJzb3IodmFsdWUsIHAucmVxdWVzdCk7XG4gICAgfSk7XG4gIH1cblxuICBmdW5jdGlvbiBwcm94eVByb3BlcnRpZXMoUHJveHlDbGFzcywgdGFyZ2V0UHJvcCwgcHJvcGVydGllcykge1xuICAgIHByb3BlcnRpZXMuZm9yRWFjaChmdW5jdGlvbihwcm9wKSB7XG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoUHJveHlDbGFzcy5wcm90b3R5cGUsIHByb3AsIHtcbiAgICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgICByZXR1cm4gdGhpc1t0YXJnZXRQcm9wXVtwcm9wXTtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0OiBmdW5jdGlvbih2YWwpIHtcbiAgICAgICAgICB0aGlzW3RhcmdldFByb3BdW3Byb3BdID0gdmFsO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHByb3h5UmVxdWVzdE1ldGhvZHMoUHJveHlDbGFzcywgdGFyZ2V0UHJvcCwgQ29uc3RydWN0b3IsIHByb3BlcnRpZXMpIHtcbiAgICBwcm9wZXJ0aWVzLmZvckVhY2goZnVuY3Rpb24ocHJvcCkge1xuICAgICAgaWYgKCEocHJvcCBpbiBDb25zdHJ1Y3Rvci5wcm90b3R5cGUpKSByZXR1cm47XG4gICAgICBQcm94eUNsYXNzLnByb3RvdHlwZVtwcm9wXSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gcHJvbWlzaWZ5UmVxdWVzdENhbGwodGhpc1t0YXJnZXRQcm9wXSwgcHJvcCwgYXJndW1lbnRzKTtcbiAgICAgIH07XG4gICAgfSk7XG4gIH1cblxuICBmdW5jdGlvbiBwcm94eU1ldGhvZHMoUHJveHlDbGFzcywgdGFyZ2V0UHJvcCwgQ29uc3RydWN0b3IsIHByb3BlcnRpZXMpIHtcbiAgICBwcm9wZXJ0aWVzLmZvckVhY2goZnVuY3Rpb24ocHJvcCkge1xuICAgICAgaWYgKCEocHJvcCBpbiBDb25zdHJ1Y3Rvci5wcm90b3R5cGUpKSByZXR1cm47XG4gICAgICBQcm94eUNsYXNzLnByb3RvdHlwZVtwcm9wXSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpc1t0YXJnZXRQcm9wXVtwcm9wXS5hcHBseSh0aGlzW3RhcmdldFByb3BdLCBhcmd1bWVudHMpO1xuICAgICAgfTtcbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHByb3h5Q3Vyc29yUmVxdWVzdE1ldGhvZHMoUHJveHlDbGFzcywgdGFyZ2V0UHJvcCwgQ29uc3RydWN0b3IsIHByb3BlcnRpZXMpIHtcbiAgICBwcm9wZXJ0aWVzLmZvckVhY2goZnVuY3Rpb24ocHJvcCkge1xuICAgICAgaWYgKCEocHJvcCBpbiBDb25zdHJ1Y3Rvci5wcm90b3R5cGUpKSByZXR1cm47XG4gICAgICBQcm94eUNsYXNzLnByb3RvdHlwZVtwcm9wXSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gcHJvbWlzaWZ5Q3Vyc29yUmVxdWVzdENhbGwodGhpc1t0YXJnZXRQcm9wXSwgcHJvcCwgYXJndW1lbnRzKTtcbiAgICAgIH07XG4gICAgfSk7XG4gIH1cblxuICBmdW5jdGlvbiBJbmRleChpbmRleCkge1xuICAgIHRoaXMuX2luZGV4ID0gaW5kZXg7XG4gIH1cblxuICBwcm94eVByb3BlcnRpZXMoSW5kZXgsICdfaW5kZXgnLCBbXG4gICAgJ25hbWUnLFxuICAgICdrZXlQYXRoJyxcbiAgICAnbXVsdGlFbnRyeScsXG4gICAgJ3VuaXF1ZSdcbiAgXSk7XG5cbiAgcHJveHlSZXF1ZXN0TWV0aG9kcyhJbmRleCwgJ19pbmRleCcsIElEQkluZGV4LCBbXG4gICAgJ2dldCcsXG4gICAgJ2dldEtleScsXG4gICAgJ2dldEFsbCcsXG4gICAgJ2dldEFsbEtleXMnLFxuICAgICdjb3VudCdcbiAgXSk7XG5cbiAgcHJveHlDdXJzb3JSZXF1ZXN0TWV0aG9kcyhJbmRleCwgJ19pbmRleCcsIElEQkluZGV4LCBbXG4gICAgJ29wZW5DdXJzb3InLFxuICAgICdvcGVuS2V5Q3Vyc29yJ1xuICBdKTtcblxuICBmdW5jdGlvbiBDdXJzb3IoY3Vyc29yLCByZXF1ZXN0KSB7XG4gICAgdGhpcy5fY3Vyc29yID0gY3Vyc29yO1xuICAgIHRoaXMuX3JlcXVlc3QgPSByZXF1ZXN0O1xuICB9XG5cbiAgcHJveHlQcm9wZXJ0aWVzKEN1cnNvciwgJ19jdXJzb3InLCBbXG4gICAgJ2RpcmVjdGlvbicsXG4gICAgJ2tleScsXG4gICAgJ3ByaW1hcnlLZXknLFxuICAgICd2YWx1ZSdcbiAgXSk7XG5cbiAgcHJveHlSZXF1ZXN0TWV0aG9kcyhDdXJzb3IsICdfY3Vyc29yJywgSURCQ3Vyc29yLCBbXG4gICAgJ3VwZGF0ZScsXG4gICAgJ2RlbGV0ZSdcbiAgXSk7XG5cbiAgLy8gcHJveHkgJ25leHQnIG1ldGhvZHNcbiAgWydhZHZhbmNlJywgJ2NvbnRpbnVlJywgJ2NvbnRpbnVlUHJpbWFyeUtleSddLmZvckVhY2goZnVuY3Rpb24obWV0aG9kTmFtZSkge1xuICAgIGlmICghKG1ldGhvZE5hbWUgaW4gSURCQ3Vyc29yLnByb3RvdHlwZSkpIHJldHVybjtcbiAgICBDdXJzb3IucHJvdG90eXBlW21ldGhvZE5hbWVdID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgY3Vyc29yID0gdGhpcztcbiAgICAgIHZhciBhcmdzID0gYXJndW1lbnRzO1xuICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpLnRoZW4oZnVuY3Rpb24oKSB7XG4gICAgICAgIGN1cnNvci5fY3Vyc29yW21ldGhvZE5hbWVdLmFwcGx5KGN1cnNvci5fY3Vyc29yLCBhcmdzKTtcbiAgICAgICAgcmV0dXJuIHByb21pc2lmeVJlcXVlc3QoY3Vyc29yLl9yZXF1ZXN0KS50aGVuKGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgICAgaWYgKCF2YWx1ZSkgcmV0dXJuO1xuICAgICAgICAgIHJldHVybiBuZXcgQ3Vyc29yKHZhbHVlLCBjdXJzb3IuX3JlcXVlc3QpO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH07XG4gIH0pO1xuXG4gIGZ1bmN0aW9uIE9iamVjdFN0b3JlKHN0b3JlKSB7XG4gICAgdGhpcy5fc3RvcmUgPSBzdG9yZTtcbiAgfVxuXG4gIE9iamVjdFN0b3JlLnByb3RvdHlwZS5jcmVhdGVJbmRleCA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBuZXcgSW5kZXgodGhpcy5fc3RvcmUuY3JlYXRlSW5kZXguYXBwbHkodGhpcy5fc3RvcmUsIGFyZ3VtZW50cykpO1xuICB9O1xuXG4gIE9iamVjdFN0b3JlLnByb3RvdHlwZS5pbmRleCA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBuZXcgSW5kZXgodGhpcy5fc3RvcmUuaW5kZXguYXBwbHkodGhpcy5fc3RvcmUsIGFyZ3VtZW50cykpO1xuICB9O1xuXG4gIHByb3h5UHJvcGVydGllcyhPYmplY3RTdG9yZSwgJ19zdG9yZScsIFtcbiAgICAnbmFtZScsXG4gICAgJ2tleVBhdGgnLFxuICAgICdpbmRleE5hbWVzJyxcbiAgICAnYXV0b0luY3JlbWVudCdcbiAgXSk7XG5cbiAgcHJveHlSZXF1ZXN0TWV0aG9kcyhPYmplY3RTdG9yZSwgJ19zdG9yZScsIElEQk9iamVjdFN0b3JlLCBbXG4gICAgJ3B1dCcsXG4gICAgJ2FkZCcsXG4gICAgJ2RlbGV0ZScsXG4gICAgJ2NsZWFyJyxcbiAgICAnZ2V0JyxcbiAgICAnZ2V0QWxsJyxcbiAgICAnZ2V0S2V5JyxcbiAgICAnZ2V0QWxsS2V5cycsXG4gICAgJ2NvdW50J1xuICBdKTtcblxuICBwcm94eUN1cnNvclJlcXVlc3RNZXRob2RzKE9iamVjdFN0b3JlLCAnX3N0b3JlJywgSURCT2JqZWN0U3RvcmUsIFtcbiAgICAnb3BlbkN1cnNvcicsXG4gICAgJ29wZW5LZXlDdXJzb3InXG4gIF0pO1xuXG4gIHByb3h5TWV0aG9kcyhPYmplY3RTdG9yZSwgJ19zdG9yZScsIElEQk9iamVjdFN0b3JlLCBbXG4gICAgJ2RlbGV0ZUluZGV4J1xuICBdKTtcblxuICBmdW5jdGlvbiBUcmFuc2FjdGlvbihpZGJUcmFuc2FjdGlvbikge1xuICAgIHRoaXMuX3R4ID0gaWRiVHJhbnNhY3Rpb247XG4gICAgdGhpcy5jb21wbGV0ZSA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgaWRiVHJhbnNhY3Rpb24ub25jb21wbGV0ZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXNvbHZlKCk7XG4gICAgICB9O1xuICAgICAgaWRiVHJhbnNhY3Rpb24ub25lcnJvciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZWplY3QoaWRiVHJhbnNhY3Rpb24uZXJyb3IpO1xuICAgICAgfTtcbiAgICAgIGlkYlRyYW5zYWN0aW9uLm9uYWJvcnQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmVqZWN0KGlkYlRyYW5zYWN0aW9uLmVycm9yKTtcbiAgICAgIH07XG4gICAgfSk7XG4gIH1cblxuICBUcmFuc2FjdGlvbi5wcm90b3R5cGUub2JqZWN0U3RvcmUgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gbmV3IE9iamVjdFN0b3JlKHRoaXMuX3R4Lm9iamVjdFN0b3JlLmFwcGx5KHRoaXMuX3R4LCBhcmd1bWVudHMpKTtcbiAgfTtcblxuICBwcm94eVByb3BlcnRpZXMoVHJhbnNhY3Rpb24sICdfdHgnLCBbXG4gICAgJ29iamVjdFN0b3JlTmFtZXMnLFxuICAgICdtb2RlJ1xuICBdKTtcblxuICBwcm94eU1ldGhvZHMoVHJhbnNhY3Rpb24sICdfdHgnLCBJREJUcmFuc2FjdGlvbiwgW1xuICAgICdhYm9ydCdcbiAgXSk7XG5cbiAgZnVuY3Rpb24gVXBncmFkZURCKGRiLCBvbGRWZXJzaW9uLCB0cmFuc2FjdGlvbikge1xuICAgIHRoaXMuX2RiID0gZGI7XG4gICAgdGhpcy5vbGRWZXJzaW9uID0gb2xkVmVyc2lvbjtcbiAgICB0aGlzLnRyYW5zYWN0aW9uID0gbmV3IFRyYW5zYWN0aW9uKHRyYW5zYWN0aW9uKTtcbiAgfVxuXG4gIFVwZ3JhZGVEQi5wcm90b3R5cGUuY3JlYXRlT2JqZWN0U3RvcmUgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gbmV3IE9iamVjdFN0b3JlKHRoaXMuX2RiLmNyZWF0ZU9iamVjdFN0b3JlLmFwcGx5KHRoaXMuX2RiLCBhcmd1bWVudHMpKTtcbiAgfTtcblxuICBwcm94eVByb3BlcnRpZXMoVXBncmFkZURCLCAnX2RiJywgW1xuICAgICduYW1lJyxcbiAgICAndmVyc2lvbicsXG4gICAgJ29iamVjdFN0b3JlTmFtZXMnXG4gIF0pO1xuXG4gIHByb3h5TWV0aG9kcyhVcGdyYWRlREIsICdfZGInLCBJREJEYXRhYmFzZSwgW1xuICAgICdkZWxldGVPYmplY3RTdG9yZScsXG4gICAgJ2Nsb3NlJ1xuICBdKTtcblxuICBmdW5jdGlvbiBEQihkYikge1xuICAgIHRoaXMuX2RiID0gZGI7XG4gIH1cblxuICBEQi5wcm90b3R5cGUudHJhbnNhY3Rpb24gPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gbmV3IFRyYW5zYWN0aW9uKHRoaXMuX2RiLnRyYW5zYWN0aW9uLmFwcGx5KHRoaXMuX2RiLCBhcmd1bWVudHMpKTtcbiAgfTtcblxuICBwcm94eVByb3BlcnRpZXMoREIsICdfZGInLCBbXG4gICAgJ25hbWUnLFxuICAgICd2ZXJzaW9uJyxcbiAgICAnb2JqZWN0U3RvcmVOYW1lcydcbiAgXSk7XG5cbiAgcHJveHlNZXRob2RzKERCLCAnX2RiJywgSURCRGF0YWJhc2UsIFtcbiAgICAnY2xvc2UnXG4gIF0pO1xuXG4gIC8vIEFkZCBjdXJzb3IgaXRlcmF0b3JzXG4gIC8vIFRPRE86IHJlbW92ZSB0aGlzIG9uY2UgYnJvd3NlcnMgZG8gdGhlIHJpZ2h0IHRoaW5nIHdpdGggcHJvbWlzZXNcbiAgWydvcGVuQ3Vyc29yJywgJ29wZW5LZXlDdXJzb3InXS5mb3JFYWNoKGZ1bmN0aW9uKGZ1bmNOYW1lKSB7XG4gICAgW09iamVjdFN0b3JlLCBJbmRleF0uZm9yRWFjaChmdW5jdGlvbihDb25zdHJ1Y3Rvcikge1xuICAgICAgLy8gRG9uJ3QgY3JlYXRlIGl0ZXJhdGVLZXlDdXJzb3IgaWYgb3BlbktleUN1cnNvciBkb2Vzbid0IGV4aXN0LlxuICAgICAgaWYgKCEoZnVuY05hbWUgaW4gQ29uc3RydWN0b3IucHJvdG90eXBlKSkgcmV0dXJuO1xuXG4gICAgICBDb25zdHJ1Y3Rvci5wcm90b3R5cGVbZnVuY05hbWUucmVwbGFjZSgnb3BlbicsICdpdGVyYXRlJyldID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBhcmdzID0gdG9BcnJheShhcmd1bWVudHMpO1xuICAgICAgICB2YXIgY2FsbGJhY2sgPSBhcmdzW2FyZ3MubGVuZ3RoIC0gMV07XG4gICAgICAgIHZhciBuYXRpdmVPYmplY3QgPSB0aGlzLl9zdG9yZSB8fCB0aGlzLl9pbmRleDtcbiAgICAgICAgdmFyIHJlcXVlc3QgPSBuYXRpdmVPYmplY3RbZnVuY05hbWVdLmFwcGx5KG5hdGl2ZU9iamVjdCwgYXJncy5zbGljZSgwLCAtMSkpO1xuICAgICAgICByZXF1ZXN0Lm9uc3VjY2VzcyA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIGNhbGxiYWNrKHJlcXVlc3QucmVzdWx0KTtcbiAgICAgICAgfTtcbiAgICAgIH07XG4gICAgfSk7XG4gIH0pO1xuXG4gIC8vIHBvbHlmaWxsIGdldEFsbFxuICBbSW5kZXgsIE9iamVjdFN0b3JlXS5mb3JFYWNoKGZ1bmN0aW9uKENvbnN0cnVjdG9yKSB7XG4gICAgaWYgKENvbnN0cnVjdG9yLnByb3RvdHlwZS5nZXRBbGwpIHJldHVybjtcbiAgICBDb25zdHJ1Y3Rvci5wcm90b3R5cGUuZ2V0QWxsID0gZnVuY3Rpb24ocXVlcnksIGNvdW50KSB7XG4gICAgICB2YXIgaW5zdGFuY2UgPSB0aGlzO1xuICAgICAgdmFyIGl0ZW1zID0gW107XG5cbiAgICAgIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlKSB7XG4gICAgICAgIGluc3RhbmNlLml0ZXJhdGVDdXJzb3IocXVlcnksIGZ1bmN0aW9uKGN1cnNvcikge1xuICAgICAgICAgIGlmICghY3Vyc29yKSB7XG4gICAgICAgICAgICByZXNvbHZlKGl0ZW1zKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgaXRlbXMucHVzaChjdXJzb3IudmFsdWUpO1xuXG4gICAgICAgICAgaWYgKGNvdW50ICE9PSB1bmRlZmluZWQgJiYgaXRlbXMubGVuZ3RoID09IGNvdW50KSB7XG4gICAgICAgICAgICByZXNvbHZlKGl0ZW1zKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgY3Vyc29yLmNvbnRpbnVlKCk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfTtcbiAgfSk7XG5cbiAgdmFyIGV4cCA9IHtcbiAgICBvcGVuOiBmdW5jdGlvbihuYW1lLCB2ZXJzaW9uLCB1cGdyYWRlQ2FsbGJhY2spIHtcbiAgICAgIHZhciBwID0gcHJvbWlzaWZ5UmVxdWVzdENhbGwoaW5kZXhlZERCLCAnb3BlbicsIFtuYW1lLCB2ZXJzaW9uXSk7XG4gICAgICB2YXIgcmVxdWVzdCA9IHAucmVxdWVzdDtcblxuICAgICAgaWYgKHJlcXVlc3QpIHtcbiAgICAgICAgcmVxdWVzdC5vbnVwZ3JhZGVuZWVkZWQgPSBmdW5jdGlvbihldmVudCkge1xuICAgICAgICAgIGlmICh1cGdyYWRlQ2FsbGJhY2spIHtcbiAgICAgICAgICAgIHVwZ3JhZGVDYWxsYmFjayhuZXcgVXBncmFkZURCKHJlcXVlc3QucmVzdWx0LCBldmVudC5vbGRWZXJzaW9uLCByZXF1ZXN0LnRyYW5zYWN0aW9uKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gcC50aGVuKGZ1bmN0aW9uKGRiKSB7XG4gICAgICAgIHJldHVybiBuZXcgREIoZGIpO1xuICAgICAgfSk7XG4gICAgfSxcbiAgICBkZWxldGU6IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgIHJldHVybiBwcm9taXNpZnlSZXF1ZXN0Q2FsbChpbmRleGVkREIsICdkZWxldGVEYXRhYmFzZScsIFtuYW1lXSk7XG4gICAgfVxuICB9O1xuXG4gIGlmICh0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJykge1xuICAgIG1vZHVsZS5leHBvcnRzID0gZXhwO1xuICAgIG1vZHVsZS5leHBvcnRzLmRlZmF1bHQgPSBtb2R1bGUuZXhwb3J0cztcbiAgfVxuICBlbHNlIHtcbiAgICBzZWxmLmlkYiA9IGV4cDtcbiAgfVxufSgpKTtcbiJdfQ==
