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

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _dbhelper = require('./dbhelper');

var _dbhelper2 = _interopRequireDefault(_dbhelper);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * @initialize Google map, called from HTML.
 */

document.addEventListener('DOMContentLoaded', function () {
  initMap();
});

var initMap = function initMap() {
  fetchRestaurantFromURL(function (error, restaurant) {
    if (error) {
      // Got an error!
      console.error(error);
    } else {
      if (typeof google !== 'undefined') {
        self.map = new google.maps.Map(document.getElementById('map'), {
          zoom: 16,
          center: restaurant.latlng,
          scrollwheel: false
        });
        fillBreadcrumb(self.restaurant);
        _dbhelper2.default.mapMarkerForRestaurant(self.restaurant, self.map);
      }
    }
  });
};

window.gm_authFailure = function () {
  var mapView = document.getElementById('map-container');
  mapView.innerHTML = '<p id="error-map">Authentication Error with Google Map!</p>';
};

/**
 * @add restaurant name to the breadcrumb navigation menu
 */
var fillBreadcrumb = function fillBreadcrumb(restaurant) {
  var breadcrumb = document.getElementById('breadcrumb');

  var liName = document.createElement('li');
  liName.innerHTML = restaurant.name;
  liName.className = 'breadcrum-name';
  breadcrumb.append(liName);

  var liIcon = document.createElement('li');
  //get fillFavoritesHTML() from main.js
  liIcon.append(_dbhelper2.default.fillFavoritesHTML(restaurant));

  breadcrumb.append(liIcon);
};

/**
 * @get a parameter by name from page URL.
 */
var getParameterByName = function getParameterByName(name, url) {
  if (!url) url = window.location.href;
  name = name.replace(/[[\]]/g, '\\$&');
  var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
      results = regex.exec(url);
  if (!results) return null;
  if (!results[2]) return '';
  return decodeURIComponent(results[2].replace(/\+/g, ' '));
};

/**
 * @get current restaurant from page URL.
 */
var fetchRestaurantFromURL = function fetchRestaurantFromURL(callback) {
  if (self.restaurant) {
    // restaurant already fetched!
    callback(null, self.restaurant);
    return;
  }
  var id = getParameterByName('id');
  if (!id) {
    // no id found in URL
    var error = 'No restaurant id in URL';
    callback(error, null);
  } else {
    _dbhelper2.default.fetchRestaurantById(id, function (error, restaurant) {
      self.restaurant = restaurant;
      if (!restaurant) {
        console.error(error);
        return;
      }
      _dbhelper2.default.fetchRestaurantReviews(self.restaurant, function (error, reviews) {
        self.restaurant.reviews = reviews;

        if (!reviews) {
          console.log(error);
        }
        fillRestaurantHTML(self.restaurant);
      });
      callback(null, restaurant);
    });
  }
};

/**
 * @create restaurant HTML and add it to the webpage
 */
var fillRestaurantHTML = function fillRestaurantHTML(restaurant) {
  var name = document.getElementById('restaurant-name');
  name.innerHTML = restaurant.name;
  name.setAttribute('tabindex', '0');

  var image = document.getElementById('restaurant-img');
  image.src = _dbhelper2.default.imageUrlForRestaurant(restaurant);
  image.alt = restaurant.name + ' is the ' + restaurant.cuisine_type + ' restaurant';
  image.setAttribute('tabindex', '0');

  var cuisine = document.getElementById('restaurant-cuisine');
  cuisine.innerHTML = restaurant.cuisine_type;
  cuisine.setAttribute('tabindex', '0');

  var address = document.getElementById('restaurant-address');
  address.innerHTML = restaurant.address;
  address.setAttribute('tabindex', '0');

  // fill operating hours
  fillRestaurantHoursHTML(restaurant.operating_hours);

  // fill reviews
  fillReviewsHTML(restaurant.reviews);
};

/**
 * @create restaurant operating hours HTML table and add it to the webpage.
 */
var fillRestaurantHoursHTML = function fillRestaurantHoursHTML(operatingHours) {
  var hours = document.getElementById('restaurant-hours');
  hours.innerHTML = '';
  for (var key in operatingHours) {
    var row = document.createElement('tr');
    row.className = 'table-row';

    var day = document.createElement('td');
    day.innerHTML = key;
    day.className = 'day-col';
    day.setAttribute('tabindex', '0');

    row.append(day);

    var time = document.createElement('td');
    time.innerHTML = operatingHours[key];
    time.className = 'time-col';
    time.setAttribute('tabindex', '0');
    row.append(time);

    hours.append(row);
  }
};

/**
 * @create all reviews HTML and add them to the webpage.
 */
var fillReviewsHTML = function fillReviewsHTML(reviews) {
  var container = document.getElementById('reviews-container');
  container.innerHTML = '';

  var ul = document.createElement('ul');
  ul.id = 'reviews-list';
  container.append(ul);

  var title = document.createElement('h3');
  title.innerHTML = 'Reviews';
  title.setAttribute('tabindex', '0');
  container.append(title);

  if (!reviews) {
    var noReviews = document.createElement('p');
    noReviews.innerHTML = 'No reviews yet!';
    container.append(noReviews);
    return;
  }

  var sortedReviews = reviews.sort(function (a, b) {
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });

  sortedReviews.forEach(function (review) {
    ul.append(createReviewHTML(review));
  });
  container.append(ul);
};

/**
 * @create review HTML and add it to the webpage.
 */
var createReviewHTML = function createReviewHTML(review) {
  var li = document.createElement('li');
  var div = document.createElement('div');
  var name = document.createElement('p');
  name.innerHTML = review.name;
  name.className = 'review-name';
  name.setAttribute('tabindex', '0');

  div.append(name);

  var date = document.createElement('p');
  date.innerHTML = new Date(review.updatedAt).toDateString();
  date.className = 'review-date';
  date.setAttribute('tabindex', '0');

  div.append(date);
  li.append(div);

  var rating = document.createElement('p');

  for (var i = 0; i < review.rating; i++) {
    var icon = document.createElement('i');
    icon.className = 'fas fa-star';
    rating.append(icon);
  }

  li.append(rating);

  var comments = document.createElement('p');
  comments.innerHTML = review.comments;
  comments.setAttribute('tabindex', '0');
  li.append(comments);

  return li;
};

/**
   * @show messages and hide when the button is clicked
   */
var showMessage = function showMessage() {
  var modal = document.getElementById('modal-overlay');
  var modalMessage = document.getElementById('modal-message');

  modalMessage.innerHTML = 'You are offline right now, the review will be sent when you are online later';
  modal.style.display = 'block';

  var button = document.getElementById('bttn-close');
  button.addEventListener('click', function () {
    modal.style.display = 'none';
  });
};

/**
 * @submit the form, send to the server, and show it on a page
 */

var form = document.getElementById('review-form');

form.addEventListener('submit', function (e) {
  e.preventDefault();
  var review = {
    'restaurant_id': self.restaurant.id
  };
  var formData = new FormData(form);
  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = formData.entries()[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var _ref = _step.value;

      var _ref2 = _slicedToArray(_ref, 2);

      var key = _ref2[0];
      var value = _ref2[1];

      review[key] = value;
    }
  } catch (err) {
    _didIteratorError = true;
    _iteratorError = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion && _iterator.return) {
        _iterator.return();
      }
    } finally {
      if (_didIteratorError) {
        throw _iteratorError;
      }
    }
  }

  if (!navigator.onLine) {
    showMessage();
  }
  _dbhelper2.default.createRestaurantReview(review).then(function () {
    form.reset();
    _dbhelper2.default.fetchRestaurantReviews(self.restaurant, function (error, reviews) {
      if (!reviews) {
        console.log(error);
      }
      fillReviewsHTML(reviews);
    });
  }).catch(function (error) {
    return console.error('err', error);
  });
});

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJqcy9kYmhlbHBlci5qcyIsImpzL3Jlc3RhdXJhbnRfaW5mby5qcyIsIm5vZGVfbW9kdWxlcy9pZGIvbGliL2lkYi5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBOzs7Ozs7OztBQUVBOzs7Ozs7OztBQUVBOzs7O0lBSU0sUTs7Ozs7Ozs7O0FBV0o7OzsyQ0FHOEIsVSxFQUFZLEcsRUFBSztBQUM3QyxlQUFTLGFBQVQ7QUFDQSxVQUFNLFNBQVMsSUFBSSxPQUFPLElBQVAsQ0FBWSxNQUFoQixDQUF1QjtBQUNwQyxrQkFBVSxXQUFXLE1BRGU7QUFFcEMsZUFBTyxXQUFXLElBRmtCO0FBR3BDLGFBQUssU0FBUyxnQkFBVCxDQUEwQixVQUExQixDQUgrQjtBQUlwQyxhQUFLLEdBSitCO0FBS3BDLG1CQUFXLE9BQU8sSUFBUCxDQUFZLFNBQVosQ0FBc0I7QUFMRyxPQUF2QixDQUFmO0FBT0EsYUFBTyxNQUFQO0FBQ0Q7QUFDRDs7Ozs7O29DQUd1QjtBQUNyQixhQUFPLElBQVAsQ0FBWSxLQUFaLENBQWtCLGVBQWxCLENBQWtDLEdBQWxDLEVBQXVDLE1BQXZDLEVBQStDLFlBQU07QUFDbkQsaUJBQVMsb0JBQVQsQ0FBOEIsUUFBOUIsRUFBd0MsQ0FBeEMsRUFBMkMsS0FBM0MsR0FBbUQsYUFBbkQ7QUFDRCxPQUZEO0FBR0Q7O0FBRUQ7Ozs7OzttQ0FHc0I7QUFDcEIsVUFBSSxDQUFDLFVBQVUsYUFBZixFQUE4QjtBQUM1QixlQUFPLFFBQVEsT0FBUixFQUFQO0FBQ0QsT0FGRCxNQUVPO0FBQ0wsZUFBTyxjQUFJLElBQUosQ0FBUyxhQUFULEVBQXdCLENBQXhCLEVBQTJCLFVBQUMsU0FBRCxFQUFlO0FBQy9DLG9CQUFVLGlCQUFWLENBQTRCLGFBQTVCLEVBQTJDLEVBQUUsU0FBUyxJQUFYLEVBQTNDO0FBQ0EsY0FBSSxjQUFjLFVBQVUsaUJBQVYsQ0FBNEIsU0FBNUIsRUFB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Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKCl7ZnVuY3Rpb24gcihlLG4sdCl7ZnVuY3Rpb24gbyhpLGYpe2lmKCFuW2ldKXtpZighZVtpXSl7dmFyIGM9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZTtpZighZiYmYylyZXR1cm4gYyhpLCEwKTtpZih1KXJldHVybiB1KGksITApO3ZhciBhPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIraStcIidcIik7dGhyb3cgYS5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGF9dmFyIHA9bltpXT17ZXhwb3J0czp7fX07ZVtpXVswXS5jYWxsKHAuZXhwb3J0cyxmdW5jdGlvbihyKXt2YXIgbj1lW2ldWzFdW3JdO3JldHVybiBvKG58fHIpfSxwLHAuZXhwb3J0cyxyLGUsbix0KX1yZXR1cm4gbltpXS5leHBvcnRzfWZvcih2YXIgdT1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlLGk9MDtpPHQubGVuZ3RoO2krKylvKHRbaV0pO3JldHVybiBvfXJldHVybiByfSkoKSIsIid1c2Ugc3RyaWN0JztcclxuXHJcbmltcG9ydCBpZGIgZnJvbSAnaWRiJztcclxuXHJcbi8qKlxyXG4gKiBDb21tb24gZGF0YWJhc2UgaGVscGVyIGZ1bmN0aW9ucy5cclxuICovXHJcblxyXG5jbGFzcyBEQkhlbHBlciB7XHJcbiAgLyoqXHJcbiAgICogRGF0YWJhc2UgVVJMLlxyXG4gICAqIENoYW5nZSB0aGlzIHRvIHJlc3RhdXJhbnRzLmpzb24gZmlsZSBsb2NhdGlvbiBvbiB5b3VyIHNlcnZlci5cclxuICAgKi9cclxuICBzdGF0aWMgZ2V0IERBVEFCQVNFX1VSTCgpIHtcclxuICAgIC8vY29uc3QgcG9ydCA9IDEzMzc7Ly8gQ2hhbmdlIHRoaXMgdG8geW91ciBzZXJ2ZXIgcG9ydFxyXG4gICAgLy9yZXR1cm4gYGh0dHBzOi8vcmVzdGF1cmFudC1yZXZpZXdzLWFwaS5oZXJva3VhcHAuY29tLzoke3BvcnR9YDtcclxuICAgIHJldHVybiAnaHR0cHM6Ly9yZXN0YXVyYW50LXJldmlld3MtYXBpLmhlcm9rdWFwcC5jb20nO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQE1hcCBtYXJrZXIgZm9yIGEgcmVzdGF1cmFudC5cclxuICAgKi9cclxuICBzdGF0aWMgbWFwTWFya2VyRm9yUmVzdGF1cmFudChyZXN0YXVyYW50LCBtYXApIHtcclxuICAgIERCSGVscGVyLmFkZFRpdGxlVG9NYXAoKTtcclxuICAgIGNvbnN0IG1hcmtlciA9IG5ldyBnb29nbGUubWFwcy5NYXJrZXIoe1xyXG4gICAgICBwb3NpdGlvbjogcmVzdGF1cmFudC5sYXRsbmcsXHJcbiAgICAgIHRpdGxlOiByZXN0YXVyYW50Lm5hbWUsXHJcbiAgICAgIHVybDogREJIZWxwZXIudXJsRm9yUmVzdGF1cmFudChyZXN0YXVyYW50KSxcclxuICAgICAgbWFwOiBtYXAsXHJcbiAgICAgIGFuaW1hdGlvbjogZ29vZ2xlLm1hcHMuQW5pbWF0aW9uLkRST1BcclxuICAgIH0pO1xyXG4gICAgcmV0dXJuIG1hcmtlcjtcclxuICB9XHJcbiAgLyoqXHJcbiAgICogQGFkZCBhdHRyaWJ1dGUgdGl0bGUgdG8gPGlmcmFtZT4gaW4gR29vZ2xlIE1hcCB0byBpbXByb3ZlIHRoZSBhY2Nlc3NpYmlsaXR5XHJcbiAgICovXHJcbiAgc3RhdGljIGFkZFRpdGxlVG9NYXAoKSB7XHJcbiAgICBnb29nbGUubWFwcy5ldmVudC5hZGRMaXN0ZW5lck9uY2UobWFwLCAnaWRsZScsICgpID0+IHtcclxuICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ2lmcmFtZScpWzBdLnRpdGxlID0gJ0dvb2dsZSBNYXBzJztcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQG9wZW4gZGF0YWJhc2UgdG8gc3RvcmUgZGF0YSByZXRyaWV2ZWQgZnJvbSB0aGUgc2VydmVyIGluIGluZGV4ZWREQiBBUElcclxuICAgKi9cclxuICBzdGF0aWMgb3BlbkRhdGFiYXNlKCkge1xyXG4gICAgaWYgKCFuYXZpZ2F0b3Iuc2VydmljZVdvcmtlcikge1xyXG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICByZXR1cm4gaWRiLm9wZW4oJ3Jlc3RhdXJhbnRzJywgMywgKHVwZ3JhZGVEYikgPT4ge1xyXG4gICAgICAgIHVwZ3JhZGVEYi5jcmVhdGVPYmplY3RTdG9yZSgncmVzdGF1cmFudHMnLCB7IGtleVBhdGg6ICdpZCcgfSk7XHJcbiAgICAgICAgbGV0IHJldmlld1N0b3JlID0gdXBncmFkZURiLmNyZWF0ZU9iamVjdFN0b3JlKCdyZXZpZXdzJywgeyBrZXlQYXRoOiAnaWQnIH0pO1xyXG4gICAgICAgIHJldmlld1N0b3JlLmNyZWF0ZUluZGV4KCdyZXN0YXVyYW50X2lkJywgJ3Jlc3RhdXJhbnRfaWQnLCB7IHVuaXF1ZTogZmFsc2UgfSk7XHJcbiAgICAgICAgdXBncmFkZURiLmNyZWF0ZU9iamVjdFN0b3JlKCdvZmZsaW5lLXJldmlld3MnLCB7IGtleVBhdGg6ICd1cGRhdGVkQXQnIH0pO1xyXG4gICAgICB9KTtcclxuICAgIH1cclxuICB9XHJcbiAgLyoqXHJcbiAgICogQGdldCBkYXRhIGZyb20gYSBzdG9yZSBpbiBJbmRleGVkREIgaWYgaXQgaXMgYXZhaWxhYmxlXHJcbiAgICovXHJcbiAgc3RhdGljIGdldENhY2hlZEluZGV4ZWREQihzdG9yZV9uYW1lKSB7XHJcbiAgICBsZXQgZGJQcm9taXNlID0gREJIZWxwZXIub3BlbkRhdGFiYXNlKCk7XHJcblxyXG4gICAgcmV0dXJuIGRiUHJvbWlzZS50aGVuKGZ1bmN0aW9uKGRiKSB7XHJcbiAgICAgIGlmKCFkYikgcmV0dXJuO1xyXG4gICAgICBsZXQgdHggPSBkYi50cmFuc2FjdGlvbihzdG9yZV9uYW1lKTtcclxuICAgICAgbGV0IHN0b3JlID0gdHgub2JqZWN0U3RvcmUoc3RvcmVfbmFtZSk7XHJcbiAgICAgIHJldHVybiBzdG9yZS5nZXRBbGwoKTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQHN0b3JlIHRoZSBkYXRhIGluIEluZGV4ZWREQiBhZnRlciBmZXRjaGluZyBpdCBmcm9tIHRoZSBzZXJ2ZXJcclxuICAgKiBAcGFyYW0gZGF0YXM6IGFyZSByZXRyaWV2ZWQgZnJvbSB0aGUgc2VydmVyLCBzdG9yZV9uYW1lOiB7c3RyaW5nfVxyXG4gICAqL1xyXG4gIHN0YXRpYyBzdG9yZURhdGFJbmRleGVkRGIoZGF0YXMsIHN0b3JlX25hbWUpIHtcclxuICAgIGxldCBkYlByb21pc2UgPSBEQkhlbHBlci5vcGVuRGF0YWJhc2UoKTtcclxuXHJcbiAgICBkYlByb21pc2UudGhlbihkYiA9PiB7XHJcbiAgICAgIGlmICghZGIpIHJldHVybjtcclxuICAgICAgY29uc3QgdHggPSBkYi50cmFuc2FjdGlvbihzdG9yZV9uYW1lLCAncmVhZHdyaXRlJyk7XHJcbiAgICAgIGNvbnN0IHN0b3JlID0gdHgub2JqZWN0U3RvcmUoc3RvcmVfbmFtZSk7XHJcblxyXG4gICAgICBkYXRhcy5mb3JFYWNoKGRhdGEgPT4ge1xyXG4gICAgICAgIHN0b3JlLnB1dChkYXRhKTtcclxuICAgICAgfSk7XHJcbiAgICAgIHJldHVybiB0eC5jb21wbGV0ZTtcclxuICAgIH0pO1xyXG4gIH1cclxuICAvKipcclxuICAgKiBAZmV0Y2ggYWxsIHJlc3RhdXJhbnRzIGZvcm0gSW5kZXhlZERCIGlmIHRoZXkgZXhpc3Qgb3RoZXJ3aXNlIGZldGNoIGZyb20gdGhlIHNlcnZlci5cclxuICAgKi9cclxuICBzdGF0aWMgZmV0Y2hSZXN0YXVyYW50cyhjYWxsYmFjaykge1xyXG4gICAgLy9jaGVjayBpZiBkYXRhIGV4aXN0cyBpbiBpbmRleERCIEFQSSBpZiBpdCBkb2VzIHJldHVybiBjYWxsYmFja1xyXG4gICAgREJIZWxwZXIuZ2V0Q2FjaGVkSW5kZXhlZERCKCdyZXN0YXVyYW50cycpLnRoZW4ocmVzdWx0cyA9PiB7XHJcbiAgICAgIGlmIChyZXN1bHRzICYmIHJlc3VsdHMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHJlc3VsdHMpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIC8vIFVzZSBlbHNlIGNvbmRpdGlvbiB0byBhdm9pZCBmZXRjaGluZyBmcm9tIHNhaWxzIHNlcnZlclxyXG4gICAgICAgIC8vIGJlY2F1c2UgdXBkYXRpbmcgZmF2b3JpdGUgb24gdGhlIHNhaWxzIHNlcnZlciBpcyBub3QgcGVyc2lzdGVudFxyXG4gICAgICAgIC8vIGFuZCB0byBnZXQgZGF0YSBmcm9tIEluZGV4ZWREQiBvbmx5XHJcbiAgICAgICAgZmV0Y2goYCR7REJIZWxwZXIuREFUQUJBU0VfVVJMfS9yZXN0YXVyYW50c2ApXHJcbiAgICAgICAgICAudGhlbihyZXNwb25zZSA9PiByZXNwb25zZS5qc29uKCkpXHJcbiAgICAgICAgICAudGhlbihyZXN0YXVyYW50cyA9PiB7XHJcbiAgICAgICAgICAgIC8vc3RvcmUgZGF0YSBpbiBpbmRleERCIEFQSSBhZnRlciBmZXRjaGluZ1xyXG4gICAgICAgICAgICBEQkhlbHBlci5zdG9yZURhdGFJbmRleGVkRGIocmVzdGF1cmFudHMsICdyZXN0YXVyYW50cycpO1xyXG4gICAgICAgICAgICByZXR1cm4gY2FsbGJhY2sobnVsbCwgcmVzdGF1cmFudHMpO1xyXG4gICAgICAgICAgfSlcclxuICAgICAgICAgIC5jYXRjaChlcnIgPT4ge1xyXG4gICAgICAgICAgICByZXR1cm4gY2FsbGJhY2soZXJyICwgbnVsbCk7XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgfVxyXG4gIC8qKlxyXG4gICAqIEBmZXRjaCBhbGwgcmV2aWV3cyBmb3JtIEluZGV4ZWREQiBpZiB0aGV5IGV4aXN0IG90aGVyd2lzZSBmZXRjaCBmcm9tIHRoZSBzZXJ2ZXIuXHJcbiAgICovXHJcbiAgc3RhdGljIGZldGNoUmVzdGF1cmFudFJldmlld3MocmVzdGF1cmFudCwgY2FsbGJhY2spIHtcclxuICAgIGxldCBkYlByb21pc2UgPSBEQkhlbHBlci5vcGVuRGF0YWJhc2UoKTtcclxuXHJcbiAgICBkYlByb21pc2UudGhlbihkYiA9PiB7XHJcbiAgICAgIGlmICghZGIpIHJldHVybjtcclxuXHJcbiAgICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oJ3Jldmlld3MnKTtcclxuICAgICAgY29uc3Qgc3RvcmUgPSB0eC5vYmplY3RTdG9yZSgncmV2aWV3cycpO1xyXG4gICAgICBjb25zdCBpbmRleCA9IHN0b3JlLmluZGV4KCdyZXN0YXVyYW50X2lkJyk7XHJcblxyXG4gICAgICBpbmRleC5nZXRBbGwocmVzdGF1cmFudC5pZCkudGhlbihyZXN1bHRzID0+IHtcclxuICAgICAgICBjYWxsYmFjayhudWxsLCByZXN1bHRzKTtcclxuXHJcbiAgICAgICAgaWYgKCFuYXZpZ2F0b3Iub25MaW5lKSB7XHJcbiAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBmZXRjaChgJHtEQkhlbHBlci5EQVRBQkFTRV9VUkx9L3Jldmlld3MvP3Jlc3RhdXJhbnRfaWQ9JHtyZXN0YXVyYW50LmlkfWApXHJcbiAgICAgICAgICAudGhlbihyZXNwb25zZSA9PiB7XHJcbiAgICAgICAgICAgIHJldHVybiByZXNwb25zZS5qc29uKCk7XHJcbiAgICAgICAgICB9KVxyXG4gICAgICAgICAgLnRoZW4ocmV2aWV3cyA9PiB7XHJcbiAgICAgICAgICAgIC8vc3RvcmUgZGF0YSBpbiBpbmRleERCIEFQSSBhZnRlciBmZXRjaGluZ1xyXG4gICAgICAgICAgICBsZXQgcmV2aWV3c0xlbiA9IHJldmlld3MubGVuZ3RoO1xyXG4gICAgICAgICAgICBpZiAocmV2aWV3c0xlbiA+PSAyOSkge1xyXG4gICAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcmV2aWV3c0xlbiAtIDIwOyBpKyspIHtcclxuICAgICAgICAgICAgICAgIERCSGVscGVyLmRlbGV0ZVJlc3RhdXJhbnRSZXZpZXdzKHJldmlld3NbaV0uaWQpO1xyXG4gICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBEQkhlbHBlci5zdG9yZURhdGFJbmRleGVkRGIocmV2aWV3cywgJ3Jldmlld3MnKTtcclxuICAgICAgICAgICAgY2FsbGJhY2sobnVsbCwgcmV2aWV3cyk7XHJcbiAgICAgICAgICB9KVxyXG4gICAgICAgICAgLmNhdGNoKGVyciA9PiB7XHJcbiAgICAgICAgICAgIGNhbGxiYWNrKGVyciAsIG51bGwpO1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBAZmV0Y2ggYSByZXN0YXVyYW50IGJ5IGl0cyBJRC5cclxuICAgKi9cclxuICBzdGF0aWMgZmV0Y2hSZXN0YXVyYW50QnlJZChpZCwgY2FsbGJhY2spIHtcclxuICAgIC8vIGZldGNoIGFsbCByZXN0YXVyYW50cyB3aXRoIHByb3BlciBlcnJvciBoYW5kbGluZy5cclxuICAgIERCSGVscGVyLmZldGNoUmVzdGF1cmFudHMoKGVycm9yLCByZXN0YXVyYW50cykgPT4ge1xyXG4gICAgICBpZiAoZXJyb3IpIHtcclxuICAgICAgICBjYWxsYmFjayhlcnJvciwgbnVsbCk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgY29uc3QgcmVzdGF1cmFudCA9IHJlc3RhdXJhbnRzLmZpbmQociA9PiByLmlkID09IGlkKTtcclxuICAgICAgICBpZiAocmVzdGF1cmFudCkgeyAvLyBHb3QgdGhlIHJlc3RhdXJhbnRcclxuICAgICAgICAgIGNhbGxiYWNrKG51bGwsIHJlc3RhdXJhbnQpO1xyXG4gICAgICAgIH0gZWxzZSB7IC8vIFJlc3RhdXJhbnQgZG9lcyBub3QgZXhpc3QgaW4gdGhlIGRhdGFiYXNlXHJcbiAgICAgICAgICBjYWxsYmFjaygnUmVzdGF1cmFudCBkb2VzIG5vdCBleGlzdCcsIG51bGwpO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBAZmV0Y2ggcmVzdGF1cmFudHMgYnkgYSBjdWlzaW5lIHR5cGUgd2l0aCBwcm9wZXIgZXJyb3IgaGFuZGxpbmcuXHJcbiAgICovXHJcbiAgc3RhdGljIGZldGNoUmVzdGF1cmFudEJ5Q3Vpc2luZShjdWlzaW5lLCBjYWxsYmFjaykge1xyXG4gICAgLy8gRmV0Y2ggYWxsIHJlc3RhdXJhbnRzICB3aXRoIHByb3BlciBlcnJvciBoYW5kbGluZ1xyXG4gICAgREJIZWxwZXIuZmV0Y2hSZXN0YXVyYW50cygoZXJyb3IsIHJlc3RhdXJhbnRzKSA9PiB7XHJcbiAgICAgIGlmIChlcnJvcikge1xyXG4gICAgICAgIGNhbGxiYWNrKGVycm9yLCBudWxsKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICAvLyBGaWx0ZXIgcmVzdGF1cmFudHMgdG8gaGF2ZSBvbmx5IGdpdmVuIGN1aXNpbmUgdHlwZVxyXG4gICAgICAgIGNvbnN0IHJlc3VsdHMgPSByZXN0YXVyYW50cy5maWx0ZXIociA9PiByLmN1aXNpbmVfdHlwZSA9PSBjdWlzaW5lKTtcclxuICAgICAgICBjYWxsYmFjayhudWxsLCByZXN1bHRzKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBAZmV0Y2ggcmVzdGF1cmFudHMgYnkgYSBuZWlnaGJvcmhvb2Qgd2l0aCBwcm9wZXIgZXJyb3IgaGFuZGxpbmcuXHJcbiAgICovXHJcbiAgc3RhdGljIGZldGNoUmVzdGF1cmFudEJ5TmVpZ2hib3Job29kKG5laWdoYm9yaG9vZCwgY2FsbGJhY2spIHtcclxuICAgIC8vIEZldGNoIGFsbCByZXN0YXVyYW50c1xyXG4gICAgREJIZWxwZXIuZmV0Y2hSZXN0YXVyYW50cygoZXJyb3IsIHJlc3RhdXJhbnRzKSA9PiB7XHJcbiAgICAgIGlmIChlcnJvcikge1xyXG4gICAgICAgIGNhbGxiYWNrKGVycm9yLCBudWxsKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICAvLyBGaWx0ZXIgcmVzdGF1cmFudHMgdG8gaGF2ZSBvbmx5IGdpdmVuIG5laWdoYm9yaG9vZFxyXG4gICAgICAgIGNvbnN0IHJlc3VsdHMgPSByZXN0YXVyYW50cy5maWx0ZXIociA9PiByLm5laWdoYm9yaG9vZCA9PSBuZWlnaGJvcmhvb2QpO1xyXG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHJlc3VsdHMpO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEBmZXRjaCByZXN0YXVyYW50cyBieSBhIGN1aXNpbmUgYW5kIGEgbmVpZ2hib3Job29kIHdpdGggcHJvcGVyIGVycm9yIGhhbmRsaW5nLlxyXG4gICAqL1xyXG4gIHN0YXRpYyBmZXRjaFJlc3RhdXJhbnRCeUN1aXNpbmVBbmROZWlnaGJvcmhvb2QoY3Vpc2luZSwgbmVpZ2hib3Job29kLCBjYWxsYmFjaykge1xyXG4gICAgLy8gRmV0Y2ggYWxsIHJlc3RhdXJhbnRzXHJcbiAgICBEQkhlbHBlci5mZXRjaFJlc3RhdXJhbnRzKChlcnJvciwgcmVzdGF1cmFudHMpID0+IHtcclxuICAgICAgaWYgKGVycm9yKSB7XHJcbiAgICAgICAgY2FsbGJhY2soZXJyb3IsIG51bGwpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGxldCByZXN1bHRzID0gcmVzdGF1cmFudHM7XHJcbiAgICAgICAgaWYgKGN1aXNpbmUgIT0gJ2FsbCcpIHsgLy8gZmlsdGVyIGJ5IGN1aXNpbmVcclxuICAgICAgICAgIHJlc3VsdHMgPSByZXN1bHRzLmZpbHRlcihyID0+IHIuY3Vpc2luZV90eXBlID09IGN1aXNpbmUpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAobmVpZ2hib3Job29kICE9ICdhbGwnKSB7IC8vIGZpbHRlciBieSBuZWlnaGJvcmhvb2RcclxuICAgICAgICAgIHJlc3VsdHMgPSByZXN1bHRzLmZpbHRlcihyID0+IHIubmVpZ2hib3Job29kID09IG5laWdoYm9yaG9vZCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHJlc3VsdHMpO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHN0YXRpYyBmZXRjaFJlc3RhdXJhbnRCeUN1aXNpbmVOZWlnaGJvcmhvb2RBbmRGYXZvcml0ZShjdWlzaW5lLCBuZWlnaGJvcmhvb2QsIGZhdm9yaXRlLCBjYWxsYmFjaykge1xyXG4gICAgLy8gRmV0Y2ggYWxsIHJlc3RhdXJhbnRzXHJcbiAgICBEQkhlbHBlci5mZXRjaFJlc3RhdXJhbnRzKChlcnJvciwgcmVzdGF1cmFudHMpID0+IHtcclxuICAgICAgaWYgKGVycm9yKSB7XHJcbiAgICAgICAgY2FsbGJhY2soZXJyb3IsIG51bGwpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGxldCByZXN1bHRzID0gcmVzdGF1cmFudHM7XHJcbiAgICAgICAgaWYgKGN1aXNpbmUgIT0gJ2FsbCcpIHsgLy8gZmlsdGVyIGJ5IGN1aXNpbmVcclxuICAgICAgICAgIHJlc3VsdHMgPSByZXN1bHRzLmZpbHRlcihyID0+IHIuY3Vpc2luZV90eXBlID09IGN1aXNpbmUpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAobmVpZ2hib3Job29kICE9ICdhbGwnKSB7IC8vIGZpbHRlciBieSBuZWlnaGJvcmhvb2RcclxuICAgICAgICAgIHJlc3VsdHMgPSByZXN1bHRzLmZpbHRlcihyID0+IHIubmVpZ2hib3Job29kID09IG5laWdoYm9yaG9vZCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChmYXZvcml0ZSA9PSAndHJ1ZScpIHtcclxuICAgICAgICAgIHJlc3VsdHMgPSByZXN1bHRzLmZpbHRlcihyID0+IHIuaXNfZmF2b3JpdGUgPT0gJ3RydWUnKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgY2FsbGJhY2sobnVsbCwgcmVzdWx0cyk7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQGZldGNoIGFsbCBuZWlnaGJvcmhvb2RzIHdpdGggcHJvcGVyIGVycm9yIGhhbmRsaW5nLlxyXG4gICAqL1xyXG4gIHN0YXRpYyBmZXRjaE5laWdoYm9yaG9vZHMoY2FsbGJhY2spIHtcclxuICAgIC8vIEZldGNoIGFsbCByZXN0YXVyYW50c1xyXG4gICAgREJIZWxwZXIuZmV0Y2hSZXN0YXVyYW50cygoZXJyb3IsIHJlc3RhdXJhbnRzKSA9PiB7XHJcbiAgICAgIGlmIChlcnJvcikge1xyXG4gICAgICAgIGNhbGxiYWNrKGVycm9yLCBudWxsKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICAvLyBHZXQgYWxsIG5laWdoYm9yaG9vZHMgZnJvbSBhbGwgcmVzdGF1cmFudHNcclxuICAgICAgICBjb25zdCBuZWlnaGJvcmhvb2RzID0gcmVzdGF1cmFudHMubWFwKCh2LCBpKSA9PiByZXN0YXVyYW50c1tpXS5uZWlnaGJvcmhvb2QpO1xyXG4gICAgICAgIC8vIFJlbW92ZSBkdXBsaWNhdGVzIGZyb20gbmVpZ2hib3Job29kc1xyXG4gICAgICAgIGNvbnN0IHVuaXF1ZU5laWdoYm9yaG9vZHMgPSBuZWlnaGJvcmhvb2RzLmZpbHRlcigodiwgaSkgPT4gbmVpZ2hib3Job29kcy5pbmRleE9mKHYpID09IGkpO1xyXG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHVuaXF1ZU5laWdoYm9yaG9vZHMpO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEBmZXRjaCBhbGwgY3Vpc2luZXMgd2l0aCBwcm9wZXIgZXJyb3IgaGFuZGxpbmcuXHJcbiAgICovXHJcbiAgc3RhdGljIGZldGNoQ3Vpc2luZXMoY2FsbGJhY2spIHtcclxuICAgIC8vIEZldGNoIGFsbCByZXN0YXVyYW50c1xyXG4gICAgREJIZWxwZXIuZmV0Y2hSZXN0YXVyYW50cygoZXJyb3IsIHJlc3RhdXJhbnRzKSA9PiB7XHJcbiAgICAgIGlmIChlcnJvcikge1xyXG4gICAgICAgIGNhbGxiYWNrKGVycm9yLCBudWxsKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICAvLyBHZXQgYWxsIGN1aXNpbmVzIGZyb20gYWxsIHJlc3RhdXJhbnRzXHJcbiAgICAgICAgY29uc3QgY3Vpc2luZXMgPSByZXN0YXVyYW50cy5tYXAoKHYsIGkpID0+IHJlc3RhdXJhbnRzW2ldLmN1aXNpbmVfdHlwZSk7XHJcbiAgICAgICAgLy8gUmVtb3ZlIGR1cGxpY2F0ZXMgZnJvbSBjdWlzaW5lc1xyXG4gICAgICAgIGNvbnN0IHVuaXF1ZUN1aXNpbmVzID0gY3Vpc2luZXMuZmlsdGVyKCh2LCBpKSA9PiBjdWlzaW5lcy5pbmRleE9mKHYpID09IGkpO1xyXG4gICAgICAgIGNhbGxiYWNrKG51bGwsIHVuaXF1ZUN1aXNpbmVzKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBAcmVzdGF1cmFudCBwYWdlIFVSTC5cclxuICAgKi9cclxuICBzdGF0aWMgdXJsRm9yUmVzdGF1cmFudChyZXN0YXVyYW50KSB7XHJcbiAgICByZXR1cm4gKGAuL3Jlc3RhdXJhbnQuaHRtbD9pZD0ke3Jlc3RhdXJhbnQuaWR9YCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBAcmVzdGF1cmFudCBpbWFnZSBVUkwuXHJcbiAgICovXHJcbiAgc3RhdGljIGltYWdlVXJsRm9yUmVzdGF1cmFudChyZXN0YXVyYW50KSB7XHJcbiAgICBpZiAocmVzdGF1cmFudC5waG90b2dyYXBoID09PSB1bmRlZmluZWQpIHtcclxuICAgICAgcmVzdGF1cmFudC5waG90b2dyYXBoID0gMTA7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gKGAvaW1nLyR7cmVzdGF1cmFudC5waG90b2dyYXBofS53ZWJwYCk7XHJcbiAgfVxyXG5cclxuICBzdGF0aWMgZGVsZXRlUmVzdGF1cmFudFJldmlld3MocmV2aWV3X2lkKSB7XHJcbiAgICBmZXRjaChgJHtEQkhlbHBlci5EQVRBQkFTRV9VUkx9L3Jldmlld3MvJHtyZXZpZXdfaWR9YCwge1xyXG4gICAgICBtZXRob2Q6ICdERUxFVEUnXHJcbiAgICB9KVxyXG4gICAgICAudGhlbihyZXNwb25zZSA9PiB7XHJcbiAgICAgICAgcmV0dXJuIHJlc3BvbnNlO1xyXG4gICAgICB9KVxyXG4gICAgICAudGhlbihkYXRhID0+IHtcclxuICAgICAgICByZXR1cm4gZGF0YTtcclxuICAgICAgfSlcclxuICAgICAgLmNhdGNoKGVyciA9PiB7XHJcbiAgICAgICAgY29uc29sZS5sb2coJ0Vycm9yJywgZXJyKTtcclxuICAgICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBAcG9zdCByZXZpZXdfZGF0YSB0byB0aGUgc2VydmVyIHdoZW4gYSB1c2VyIHN1Ym1pdHMgYSByZXZpZXdcclxuICAgKiBvbmxpbmU6IGtlZXAgaXQgaW4gdGhlIHJldmlld3Mgc3RvcmUgaW4gSW5kZXhlZERCXHJcbiAgICogb2ZmbGluZToga2VlcCBpdCBpbiB0aGUgb2ZmbG5lLXJldmlld3MgaW4gSW5kZXhlZERCXHJcbiAgICogQHBhcmFtIHJldmlld19kYXRhIGlzIGZyb20gYSB1c2VyIGZpbGxzIG91dCB0aGUgZm9ybVxyXG4gICAqL1xyXG4gIHN0YXRpYyBjcmVhdGVSZXN0YXVyYW50UmV2aWV3KHJldmlld19kYXRhKSB7XHJcbiAgICByZXR1cm4gZmV0Y2goYCR7REJIZWxwZXIuREFUQUJBU0VfVVJMfS9yZXZpZXdzYCwge1xyXG4gICAgICBtZXRob2Q6ICdQT1NUJyxcclxuICAgICAgY2FjaGU6ICduby1jYWNoZScsIC8vICpkZWZhdWx0LCBuby1jYWNoZSwgcmVsb2FkLCBmb3JjZS1jYWNoZSwgb25seS1pZi1jYWNoZWRcclxuICAgICAgY3JlZGVudGlhbHM6ICdzYW1lLW9yaWdpbicsXHJcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHJldmlld19kYXRhKSxcclxuICAgICAgaGVhZGVyczoge1xyXG4gICAgICAgICdjb250ZW50LXR5cGUnOiAnYXBwbGljYXRpb24vanNvbidcclxuICAgICAgfSxcclxuICAgICAgbW9kZTogJ2NvcnMnLFxyXG4gICAgICByZWRpcmVjdDogJ2ZvbGxvdycsXHJcbiAgICAgIHJlZmVycmVyOiAnbm8tcmVmZXJyZXInLFxyXG4gICAgfSlcclxuICAgICAgLnRoZW4ocmVzcG9uc2UgPT4ge1xyXG4gICAgICAgIHJlc3BvbnNlLmpzb24oKVxyXG4gICAgICAgICAgLnRoZW4ocmV2aWV3X2RhdGEgPT4ge1xyXG4gICAgICAgICAgLyoga2VlcCBkYXRhcyBpbiBJbmRleGVkREIgYWZ0ZXIgcG9zdGluZyBkYXRhIHRvIHRoZSBzZXJ2ZXIgd2hlbiBvbmxpbmUgKi9cclxuICAgICAgICAgICAgREJIZWxwZXIuc3RvcmVEYXRhSW5kZXhlZERiKFtyZXZpZXdfZGF0YV0sICdyZXZpZXdzJyk7XHJcbiAgICAgICAgICAgIHJldHVybiByZXZpZXdfZGF0YTtcclxuICAgICAgICAgIH0pO1xyXG4gICAgICB9KVxyXG4gICAgICAuY2F0Y2goZXJyb3IgPT4ge1xyXG4gICAgICAgIHJldmlld19kYXRhWyd1cGRhdGVkQXQnXSA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xyXG4gICAgICAgIC8qIGtlZXAgZGF0YXMgaW4gSW5kZXhlZERCIGFmdGVyIHBvc3RpbmcgZGF0YSB0byB0aGUgc2VydmVyIHdoZW4gb2ZmbGluZSovXHJcbiAgICAgICAgREJIZWxwZXIuc3RvcmVEYXRhSW5kZXhlZERiKFtyZXZpZXdfZGF0YV0sICdvZmZsaW5lLXJldmlld3MnKTtcclxuICAgICAgICBjb25zb2xlLmxvZygnUmV2aWV3IHN0b3JlZCBvZmZsaW5lIGluIElEQicpO1xyXG4gICAgICAgIHJldHVybjtcclxuICAgICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBAY2xlYXIgZGF0YSBpbiB0aGUgb2ZmbGluZS1yZXZpZXdzIHN0b3JlXHJcbiAgICovXHJcbiAgc3RhdGljIGNsZWFyT2ZmbGluZVJldmlld3MoKSB7XHJcbiAgICBsZXQgZGJQcm9taXNlID0gREJIZWxwZXIub3BlbkRhdGFiYXNlKCk7XHJcbiAgICBkYlByb21pc2UudGhlbihkYiA9PiB7XHJcbiAgICAgIGNvbnN0IHR4ID0gZGIudHJhbnNhY3Rpb24oJ29mZmxpbmUtcmV2aWV3cycsICdyZWFkd3JpdGUnKTtcclxuICAgICAgY29uc3Qgc3RvcmUgPSB0eC5vYmplY3RTdG9yZSgnb2ZmbGluZS1yZXZpZXdzJyk7XHJcbiAgICAgIHN0b3JlLmNsZWFyKCk7XHJcbiAgICB9KTtcclxuICAgIHJldHVybjtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEBnZXQgcmV2aWV3cyBmcm9tIG9mZmxpbmUtc3RvcmVzIGluIEluZGV4ZWREQiB3aGVuIGEgdXNlciBnbyBmcm9tIG9mZmxpbmUgdG8gb25saW5lXHJcbiAgICovXHJcbiAgc3RhdGljIGNyZWF0ZU9mZmxpbmVSZXZpZXcoKSB7XHJcbiAgICBEQkhlbHBlci5vcGVuRGF0YWJhc2UoKS50aGVuKGRiID0+IHtcclxuICAgICAgaWYgKCFkYikgcmV0dXJuO1xyXG4gICAgICBjb25zdCB0eCA9IGRiLnRyYW5zYWN0aW9uKCdvZmZsaW5lLXJldmlld3MnLCAncmVhZHdyaXRlJyk7XHJcbiAgICAgIGNvbnN0IHN0b3JlID0gdHgub2JqZWN0U3RvcmUoJ29mZmxpbmUtcmV2aWV3cycpO1xyXG5cclxuICAgICAgc3RvcmUuZ2V0QWxsKCkudGhlbihvZmZsaW5lUmV2aWV3cyA9PiB7XHJcbiAgICAgICAgb2ZmbGluZVJldmlld3MuZm9yRWFjaChyZXZpZXcgPT4ge1xyXG4gICAgICAgICAgREJIZWxwZXIuY3JlYXRlUmVzdGF1cmFudFJldmlldyhyZXZpZXcpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIERCSGVscGVyLmNsZWFyT2ZmbGluZVJldmlld3MoKTtcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcbiAgLyoqXHJcbiAgICpAd2hlbiBvbmxpbmUgdXBkYXRlIGEgdmFsdWUgb2YgYSByZXN0YXVyYW50J3MgZmF2b3JpdGUgYnkgc2VuZGluZyB0aGUgUFVUIHJlcXVlc3QgdG8gdGhlIHNlcnZlclxyXG4gICAqYW5kIHN0b3JlIHRoZSBkYXRhIHRvIEluZGV4ZWREQiBzbyBpdCBjYW4gYmUgdXNlZCB3aGVuIG9mZmxpbmVcclxuICAqL1xyXG4gIHN0YXRpYyB0b2dnbGVGYXZvcml0ZShyZXN0YXVyYW50LCBpc0Zhdm9yaXRlKSB7XHJcbiAgICByZXR1cm4gZmV0Y2goYCR7REJIZWxwZXIuREFUQUJBU0VfVVJMfS9yZXN0YXVyYW50cy8ke3Jlc3RhdXJhbnQuaWR9Lz9pc19mYXZvcml0ZT0ke2lzRmF2b3JpdGV9YCwge1xyXG4gICAgICBtZXRob2Q6ICdQVVQnLFxyXG4gICAgfSlcclxuICAgICAgLnRoZW4ocmVzcG9uc2UgPT4ge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKGB1cGRhdGVkIEFQSSByZXN0YXVyYW50OiAke3Jlc3RhdXJhbnQuaWR9IGZhdm9yaXRlIDogJHtpc0Zhdm9yaXRlfWApO1xyXG4gICAgICAgIHJldHVybiByZXNwb25zZS5qc29uKCk7XHJcbiAgICAgIH0pXHJcbiAgICAgIC50aGVuKGRhdGEgPT4ge1xyXG4gICAgICAgIERCSGVscGVyLnN0b3JlRGF0YUluZGV4ZWREYihbZGF0YV0sICdyZXN0YXVyYW50cycpO1xyXG4gICAgICAgIGNvbnNvbGUubG9nKGB1cGRhdGVkIElEQiByZXN0YXVyYW50OiAke3Jlc3RhdXJhbnQuaWR9IGZhdm9yaXRlIDogJHtpc0Zhdm9yaXRlfWApO1xyXG4gICAgICAgIHJldHVybiBkYXRhO1xyXG4gICAgICB9KVxyXG4gICAgICAuY2F0Y2goZXJyb3IgPT4ge1xyXG4gICAgICAgIC8vIGNvbnZlcnQgZnJvbSBib29sZWFuIHRvIHN0cmluZyBiZWNhdXNlIHRoZSBBUEkgdXNlcyBzdHJpbmdzICd0cnVlJyBhbmQgJ2ZhbHNlJ1xyXG4gICAgICAgIHJlc3RhdXJhbnQuaXNfZmF2b3JpdGUgPSBpc0Zhdm9yaXRlID8gJ3RydWUnIDogJ2ZhbHNlJztcclxuXHJcbiAgICAgICAgREJIZWxwZXIuc3RvcmVEYXRhSW5kZXhlZERiKFtyZXN0YXVyYW50XSwgJ3Jlc3RhdXJhbnRzJyk7XHJcbiAgICAgICAgY29uc29sZS5sb2coJ3N0b3JlIGZhdm9yaXRlIG9mZmxpbmUnKTtcclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAqIEBmaWxsIGZhdm9yaXRlcyBpbiBIVE1MIHNvIGl0IGNhbiBiZSB1c2VkIGJ5IGJvdGggbWFpbiBhbmQgcmVzdGF1cmFudCBwYWdlXHJcbiAqL1xyXG4gIHN0YXRpYyBmaWxsRmF2b3JpdGVzSFRNTChyZXN0YXVyYW50KSB7XHJcbiAgICBjb25zdCBsYWJlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2xhYmVsJyk7XHJcbiAgICBsYWJlbC5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCAnTGFiZWwgZm9yIGNoZWNraW5nIGZhdm9yaXRlJyk7XHJcbiAgICBsYWJlbC5jbGFzc05hbWUgPSAnZmF2LWNvbnRhaW5lcic7XHJcblxyXG4gICAgY29uc3QgaWNvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2knKTtcclxuICAgIGljb24uY2xhc3NOYW1lID0gJ2ZhcyBmYS1oZWFydCc7XHJcbiAgICBsYWJlbC5hcHBlbmQoaWNvbik7XHJcblxyXG4gICAgY29uc3QgaW5wdXQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpbnB1dCcpO1xyXG4gICAgaW5wdXQudHlwZSA9ICdjaGVja2JveCc7XHJcbiAgICBpbnB1dC5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCAnU2VsZWN0IGZhdm9yaXRlJyk7XHJcblxyXG4gICAgaWYgKHJlc3RhdXJhbnQuaXNfZmF2b3JpdGUgPT0gJ3RydWUnKSB7XHJcbiAgICAgIGljb24uc3R5bGUuY29sb3IgPSAnI2QzMmYyZic7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBpY29uLnN0eWxlLmNvbG9yID0gJyNhZWIwYjEnO1xyXG4gICAgfVxyXG5cclxuICAgIGlucHV0LmNoZWNrZWQgPSAocmVzdGF1cmFudC5pc19mYXZvcml0ZSAgPT0gJ3RydWUnKTtcclxuICAgIGlucHV0LmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIGV2ZW50ID0+IHtcclxuICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgaWYgKGlucHV0LmNoZWNrZWQgPT0gdHJ1ZSkge1xyXG4gICAgICAgIERCSGVscGVyLnRvZ2dsZUZhdm9yaXRlKHJlc3RhdXJhbnQsIGlucHV0LmNoZWNrZWQpO1xyXG4gICAgICAgIGljb24uc3R5bGUuY29sb3IgPSAnI2QzMmYyZic7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgREJIZWxwZXIudG9nZ2xlRmF2b3JpdGUocmVzdGF1cmFudCwgaW5wdXQuY2hlY2tlZCk7XHJcbiAgICAgICAgaWNvbi5zdHlsZS5jb2xvciA9ICcjYWViMGIxJztcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICBsYWJlbC5hcHBlbmQoaW5wdXQpO1xyXG4gICAgcmV0dXJuIGxhYmVsO1xyXG4gIH1cclxuXHJcbiAgLypAY3JlYXRlIHRoZXNlIGZ1bmN0aW9ucyB0byBhZGQgb25saW5lIHN0YXR1cyB0byB0aGUgYnJvd3NlclxyXG4gICAqIHdoZW4gaXQgaXMgb2ZmbGluZSBpdCB3aWxsIHN0b3JlIHJldmlldyBzdWJtaXNzaW9ucyBpbiBvZmZsaW5lLXJldmlld3MgSW5kZXhlZERCXHJcbiAgICogd2hlbiBjb25uZWN0aXZpdHkgaXMgcmVlc3RhYmxpc2hlZCwgaXQgd2lsbCBjYWxsIHRoZSBmdW5jdGlvbiB0byBzaG93IG5ldyByZXZpZXdzIG9uIHRoZSBwYWdlXHJcbiAgKi9cclxuICBzdGF0aWMgb25Hb09ubGluZSgpIHtcclxuICAgIGNvbnNvbGUubG9nKCdHb2luZyBvbmxpbmUnKTtcclxuICAgIERCSGVscGVyLmNyZWF0ZU9mZmxpbmVSZXZpZXcoKTtcclxuICB9XHJcblxyXG4gIHN0YXRpYyBvbkdvT2ZmbGluZSgpIHtcclxuICAgIGNvbnNvbGUubG9nKCdHb2luZyBvZmZsaW5lJyk7XHJcbiAgfVxyXG59XHJcblxyXG53aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignb25saW5lJywgREJIZWxwZXIub25Hb09ubGluZSk7XHJcbndpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdvZmZsaW5lJywgREJIZWxwZXIub25Hb09mZmxpbmUpO1xyXG5cclxuLyogQHJlZ2lzdGVyIFNlcnZpY2VXb3JrZXIgdG8gY2FjaGUgZGF0YSBmb3IgdGhlIHNpdGVcclxuICAgKiB0byBhbGxvdyBhbnkgcGFnZSB0aGF0IGhhcyBiZWVuIHZpc2l0ZWQgaXMgYWNjZXNzaWJsZSBvZmZsaW5lXHJcbiAgICovXHJcbm5hdmlnYXRvci5zZXJ2aWNlV29ya2VyLnJlZ2lzdGVyKCcuL3N3LmpzJylcclxuICAudGhlbihmdW5jdGlvbihyZWcpIHtcclxuICAvLyBSZWdpc3RyYXRpb24gd2FzIHN1Y2Nlc3NmdWxcclxuICAgIGNvbnNvbGUubG9nKCdTZXJ2aWNlV29ya2VyIHJlZ2lzdHJhdGlvbiBzdWNjZXNzZnVsIHdpdGggc2NvcGU6ICcsIHJlZy5zY29wZSk7XHJcbiAgICBpZiAoIW5hdmlnYXRvci5zZXJ2aWNlV29ya2VyLmNvbnRyb2xsZXIpIHtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgaWYgKHJlZy53YWl0aW5nKSB7XHJcbiAgICAgIF91cGRhdGVSZWFkeShyZWcud2FpdGluZyk7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIGlmIChyZWcuaW5zdGFsbGluZykge1xyXG4gICAgICBfdHJhY2tJbnN0YWxsaW5nKHJlZy5pbnN0YWxsaW5nKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIHJlZy5hZGRFdmVudExpc3RlbmVyKCd1cGRhdGVmb3VuZCcsIGZ1bmN0aW9uICgpIHtcclxuICAgICAgX3RyYWNrSW5zdGFsbGluZyhyZWcuaW5zdGFsbGluZyk7XHJcbiAgICB9KTtcclxuXHJcbiAgICB2YXIgcmVmcmVzaGluZztcclxuICAgIG5hdmlnYXRvci5zZXJ2aWNlV29ya2VyLmFkZEV2ZW50TGlzdGVuZXIoJ2NvbnRyb2xsZXJjaGFuZ2UnLCBmdW5jdGlvbiAoKSB7XHJcbiAgICAgIGlmIChyZWZyZXNoaW5nKSByZXR1cm47XHJcbiAgICAgIHJlZnJlc2hpbmcgPSB0cnVlO1xyXG4gICAgfSk7XHJcbiAgfSlcclxuICAuY2F0Y2goZnVuY3Rpb24gKCkge1xyXG4gICAgY29uc29sZS5sb2coJ1NlcnZpY2Ugd29ya2VyIHJlZ2lzdHJhdGlvbiBmYWlsZWQnKTtcclxuICB9KTtcclxuXHJcbmxldCBfdXBkYXRlUmVhZHkgPSAod29ya2VyKSA9PiB7XHJcbiAgd29ya2VyLnBvc3RNZXNzYWdlKHthY3Rpb246ICdza2lwV2FpdGluZyd9KTtcclxufTtcclxuXHJcbmxldCAgX3RyYWNrSW5zdGFsbGluZyA9ICh3b3JrZXIpID0+IHtcclxuICBsZXQgaW5kZXhDb250cm9sbGVyID0gdGhpcztcclxuICB3b3JrZXIuYWRkRXZlbnRMaXN0ZW5lcignc3RhdGVDaGFuZ2UnLCBmdW5jdGlvbigpIHtcclxuICAgIGlmICh3b3JrZXIuc3RhdGUgPT0gJ2luc3RhbGxlZCcpIHtcclxuICAgICAgaW5kZXhDb250cm9sbGVyLl91cGRhdGVSZWFkeSh3b3JrZXIpO1xyXG4gICAgfVxyXG4gIH0pO1xyXG59O1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgREJIZWxwZXI7XHJcbiIsIid1c2Ugc3RyaWN0JztcblxuaW1wb3J0IERCSGVscGVyIGZyb20gJy4vZGJoZWxwZXInO1xuXG4vKipcbiAqIEBpbml0aWFsaXplIEdvb2dsZSBtYXAsIGNhbGxlZCBmcm9tIEhUTUwuXG4gKi9cblxuZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignRE9NQ29udGVudExvYWRlZCcsICgpID0+IHtcbiAgaW5pdE1hcCgpO1xufSk7XG5cbmxldCBpbml0TWFwID0gKCkgPT4ge1xuICBmZXRjaFJlc3RhdXJhbnRGcm9tVVJMKChlcnJvciwgcmVzdGF1cmFudCkgPT4ge1xuICAgIGlmIChlcnJvcikgeyAvLyBHb3QgYW4gZXJyb3IhXG4gICAgICBjb25zb2xlLmVycm9yKGVycm9yKTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKHR5cGVvZiBnb29nbGUgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIHNlbGYubWFwID0gbmV3IGdvb2dsZS5tYXBzLk1hcChkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbWFwJyksIHtcbiAgICAgICAgICB6b29tOiAxNixcbiAgICAgICAgICBjZW50ZXI6IHJlc3RhdXJhbnQubGF0bG5nLFxuICAgICAgICAgIHNjcm9sbHdoZWVsOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgICAgZmlsbEJyZWFkY3J1bWIoc2VsZi5yZXN0YXVyYW50KTtcbiAgICAgICAgREJIZWxwZXIubWFwTWFya2VyRm9yUmVzdGF1cmFudChzZWxmLnJlc3RhdXJhbnQsIHNlbGYubWFwKTtcbiAgICAgIH1cbiAgICB9XG4gIH0pO1xufTtcblxud2luZG93LmdtX2F1dGhGYWlsdXJlID0gKCkgPT4ge1xuICBjb25zdCBtYXBWaWV3ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ21hcC1jb250YWluZXInKTtcbiAgbWFwVmlldy5pbm5lckhUTUwgPSAnPHAgaWQ9XCJlcnJvci1tYXBcIj5BdXRoZW50aWNhdGlvbiBFcnJvciB3aXRoIEdvb2dsZSBNYXAhPC9wPic7XG59O1xuXG4vKipcbiAqIEBhZGQgcmVzdGF1cmFudCBuYW1lIHRvIHRoZSBicmVhZGNydW1iIG5hdmlnYXRpb24gbWVudVxuICovXG5sZXQgZmlsbEJyZWFkY3J1bWIgPSAocmVzdGF1cmFudCkgPT4ge1xuICBjb25zdCBicmVhZGNydW1iID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2JyZWFkY3J1bWInKTtcblxuICBjb25zdCBsaU5hbWUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdsaScpO1xuICBsaU5hbWUuaW5uZXJIVE1MID0gcmVzdGF1cmFudC5uYW1lO1xuICBsaU5hbWUuY2xhc3NOYW1lID0gJ2JyZWFkY3J1bS1uYW1lJztcbiAgYnJlYWRjcnVtYi5hcHBlbmQobGlOYW1lKTtcblxuICBjb25zdCBsaUljb24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdsaScpO1xuICAvL2dldCBmaWxsRmF2b3JpdGVzSFRNTCgpIGZyb20gbWFpbi5qc1xuICBsaUljb24uYXBwZW5kKERCSGVscGVyLmZpbGxGYXZvcml0ZXNIVE1MKHJlc3RhdXJhbnQpKTtcblxuICBicmVhZGNydW1iLmFwcGVuZChsaUljb24pO1xufTtcblxuLyoqXG4gKiBAZ2V0IGEgcGFyYW1ldGVyIGJ5IG5hbWUgZnJvbSBwYWdlIFVSTC5cbiAqL1xubGV0IGdldFBhcmFtZXRlckJ5TmFtZSA9IChuYW1lLCB1cmwpID0+IHtcbiAgaWYgKCF1cmwpXG4gICAgdXJsID0gd2luZG93LmxvY2F0aW9uLmhyZWY7XG4gIG5hbWUgPSBuYW1lLnJlcGxhY2UoL1tbXFxdXS9nLCAnXFxcXCQmJyk7XG4gIGNvbnN0IHJlZ2V4ID0gbmV3IFJlZ0V4cChgWz8mXSR7bmFtZX0oPShbXiYjXSopfCZ8I3wkKWApLFxuICAgIHJlc3VsdHMgPSByZWdleC5leGVjKHVybCk7XG4gIGlmICghcmVzdWx0cylcbiAgICByZXR1cm4gbnVsbDtcbiAgaWYgKCFyZXN1bHRzWzJdKVxuICAgIHJldHVybiAnJztcbiAgcmV0dXJuIGRlY29kZVVSSUNvbXBvbmVudChyZXN1bHRzWzJdLnJlcGxhY2UoL1xcKy9nLCAnICcpKTtcbn07XG5cbi8qKlxuICogQGdldCBjdXJyZW50IHJlc3RhdXJhbnQgZnJvbSBwYWdlIFVSTC5cbiAqL1xubGV0IGZldGNoUmVzdGF1cmFudEZyb21VUkwgPSAoY2FsbGJhY2spID0+IHtcbiAgaWYgKHNlbGYucmVzdGF1cmFudCkgeyAvLyByZXN0YXVyYW50IGFscmVhZHkgZmV0Y2hlZCFcbiAgICBjYWxsYmFjayhudWxsLCBzZWxmLnJlc3RhdXJhbnQpO1xuICAgIHJldHVybjtcbiAgfVxuICBjb25zdCBpZCA9IGdldFBhcmFtZXRlckJ5TmFtZSgnaWQnKTtcbiAgaWYgKCFpZCkgeyAvLyBubyBpZCBmb3VuZCBpbiBVUkxcbiAgICBjb25zdCBlcnJvciA9ICdObyByZXN0YXVyYW50IGlkIGluIFVSTCc7XG4gICAgY2FsbGJhY2soZXJyb3IsIG51bGwpO1xuICB9IGVsc2Uge1xuICAgIERCSGVscGVyLmZldGNoUmVzdGF1cmFudEJ5SWQoaWQsIChlcnJvciwgcmVzdGF1cmFudCkgPT4ge1xuICAgICAgc2VsZi5yZXN0YXVyYW50ID0gcmVzdGF1cmFudDtcbiAgICAgIGlmICghcmVzdGF1cmFudCkge1xuICAgICAgICBjb25zb2xlLmVycm9yKGVycm9yKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgREJIZWxwZXIuZmV0Y2hSZXN0YXVyYW50UmV2aWV3cyhzZWxmLnJlc3RhdXJhbnQsIChlcnJvciwgcmV2aWV3cykgPT4ge1xuICAgICAgICBzZWxmLnJlc3RhdXJhbnQucmV2aWV3cyA9IHJldmlld3M7XG5cbiAgICAgICAgaWYgKCFyZXZpZXdzKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coZXJyb3IpO1xuICAgICAgICB9XG4gICAgICAgIGZpbGxSZXN0YXVyYW50SFRNTChzZWxmLnJlc3RhdXJhbnQpO1xuICAgICAgfSk7XG4gICAgICBjYWxsYmFjayhudWxsLCByZXN0YXVyYW50KTtcbiAgICB9KTtcbiAgfVxufTtcblxuLyoqXG4gKiBAY3JlYXRlIHJlc3RhdXJhbnQgSFRNTCBhbmQgYWRkIGl0IHRvIHRoZSB3ZWJwYWdlXG4gKi9cbmxldCBmaWxsUmVzdGF1cmFudEhUTUwgPSAocmVzdGF1cmFudCkgPT4ge1xuICBjb25zdCBuYW1lID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Jlc3RhdXJhbnQtbmFtZScpO1xuICBuYW1lLmlubmVySFRNTCA9IHJlc3RhdXJhbnQubmFtZTtcbiAgbmFtZS5zZXRBdHRyaWJ1dGUoJ3RhYmluZGV4JywgJzAnKTtcblxuICBjb25zdCBpbWFnZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyZXN0YXVyYW50LWltZycpO1xuICBpbWFnZS5zcmMgPSBEQkhlbHBlci5pbWFnZVVybEZvclJlc3RhdXJhbnQocmVzdGF1cmFudCk7XG4gIGltYWdlLmFsdCA9IGAke3Jlc3RhdXJhbnQubmFtZX0gaXMgdGhlICR7cmVzdGF1cmFudC5jdWlzaW5lX3R5cGV9IHJlc3RhdXJhbnRgO1xuICBpbWFnZS5zZXRBdHRyaWJ1dGUoJ3RhYmluZGV4JywgJzAnKTtcblxuICBjb25zdCBjdWlzaW5lID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Jlc3RhdXJhbnQtY3Vpc2luZScpO1xuICBjdWlzaW5lLmlubmVySFRNTCA9IHJlc3RhdXJhbnQuY3Vpc2luZV90eXBlO1xuICBjdWlzaW5lLnNldEF0dHJpYnV0ZSgndGFiaW5kZXgnLCAnMCcpO1xuXG4gIGNvbnN0IGFkZHJlc3MgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmVzdGF1cmFudC1hZGRyZXNzJyk7XG4gIGFkZHJlc3MuaW5uZXJIVE1MID0gcmVzdGF1cmFudC5hZGRyZXNzO1xuICBhZGRyZXNzLnNldEF0dHJpYnV0ZSgndGFiaW5kZXgnLCAnMCcpO1xuXG4gIC8vIGZpbGwgb3BlcmF0aW5nIGhvdXJzXG4gIGZpbGxSZXN0YXVyYW50SG91cnNIVE1MKHJlc3RhdXJhbnQub3BlcmF0aW5nX2hvdXJzKTtcblxuICAvLyBmaWxsIHJldmlld3NcbiAgZmlsbFJldmlld3NIVE1MKHJlc3RhdXJhbnQucmV2aWV3cyk7XG59O1xuXG4vKipcbiAqIEBjcmVhdGUgcmVzdGF1cmFudCBvcGVyYXRpbmcgaG91cnMgSFRNTCB0YWJsZSBhbmQgYWRkIGl0IHRvIHRoZSB3ZWJwYWdlLlxuICovXG5sZXQgZmlsbFJlc3RhdXJhbnRIb3Vyc0hUTUwgPSAob3BlcmF0aW5nSG91cnMpID0+IHtcbiAgY29uc3QgaG91cnMgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmVzdGF1cmFudC1ob3VycycpO1xuICBob3Vycy5pbm5lckhUTUwgPSAnJztcbiAgZm9yIChsZXQga2V5IGluIG9wZXJhdGluZ0hvdXJzKSB7XG4gICAgY29uc3Qgcm93ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgndHInKTtcbiAgICByb3cuY2xhc3NOYW1lID0gJ3RhYmxlLXJvdyc7XG5cbiAgICBjb25zdCBkYXkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCd0ZCcpO1xuICAgIGRheS5pbm5lckhUTUwgPSBrZXk7XG4gICAgZGF5LmNsYXNzTmFtZSA9ICdkYXktY29sJztcbiAgICBkYXkuc2V0QXR0cmlidXRlKCd0YWJpbmRleCcsICcwJyk7XG5cbiAgICByb3cuYXBwZW5kKGRheSk7XG5cbiAgICBjb25zdCB0aW1lID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgndGQnKTtcbiAgICB0aW1lLmlubmVySFRNTCA9IG9wZXJhdGluZ0hvdXJzW2tleV07XG4gICAgdGltZS5jbGFzc05hbWUgPSAndGltZS1jb2wnO1xuICAgIHRpbWUuc2V0QXR0cmlidXRlKCd0YWJpbmRleCcsICcwJyk7XG4gICAgcm93LmFwcGVuZCh0aW1lKTtcblxuICAgIGhvdXJzLmFwcGVuZChyb3cpO1xuICB9XG59O1xuXG4vKipcbiAqIEBjcmVhdGUgYWxsIHJldmlld3MgSFRNTCBhbmQgYWRkIHRoZW0gdG8gdGhlIHdlYnBhZ2UuXG4gKi9cbmxldCBmaWxsUmV2aWV3c0hUTUwgPSAocmV2aWV3cykgPT4ge1xuICBjb25zdCBjb250YWluZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmV2aWV3cy1jb250YWluZXInKTtcbiAgY29udGFpbmVyLmlubmVySFRNTCA9ICcnO1xuXG4gIGNvbnN0IHVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgndWwnKTtcbiAgdWwuaWQgPSAncmV2aWV3cy1saXN0JztcbiAgY29udGFpbmVyLmFwcGVuZCh1bCk7XG5cbiAgY29uc3QgdGl0bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdoMycpO1xuICB0aXRsZS5pbm5lckhUTUwgPSAnUmV2aWV3cyc7XG4gIHRpdGxlLnNldEF0dHJpYnV0ZSgndGFiaW5kZXgnLCAnMCcpO1xuICBjb250YWluZXIuYXBwZW5kKHRpdGxlKTtcblxuICBpZiAoIXJldmlld3MpIHtcbiAgICBjb25zdCBub1Jldmlld3MgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdwJyk7XG4gICAgbm9SZXZpZXdzLmlubmVySFRNTCA9ICdObyByZXZpZXdzIHlldCEnO1xuICAgIGNvbnRhaW5lci5hcHBlbmQobm9SZXZpZXdzKTtcbiAgICByZXR1cm47XG4gIH1cblxuICBsZXQgc29ydGVkUmV2aWV3cyA9IHJldmlld3Muc29ydChmdW5jdGlvbihhLCBiKSB7XG4gICAgcmV0dXJuIG5ldyBEYXRlKGIudXBkYXRlZEF0KSAtIG5ldyBEYXRlKGEudXBkYXRlZEF0KTtcbiAgfSk7XG5cbiAgc29ydGVkUmV2aWV3cy5mb3JFYWNoKHJldmlldyA9PiB7XG4gICAgdWwuYXBwZW5kKGNyZWF0ZVJldmlld0hUTUwocmV2aWV3KSk7XG4gIH0pO1xuICBjb250YWluZXIuYXBwZW5kKHVsKTtcbn07XG5cbi8qKlxuICogQGNyZWF0ZSByZXZpZXcgSFRNTCBhbmQgYWRkIGl0IHRvIHRoZSB3ZWJwYWdlLlxuICovXG5sZXQgY3JlYXRlUmV2aWV3SFRNTCA9IChyZXZpZXcpID0+IHtcbiAgY29uc3QgbGkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdsaScpO1xuICBjb25zdCBkaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgY29uc3QgbmFtZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3AnKTtcbiAgbmFtZS5pbm5lckhUTUwgPSByZXZpZXcubmFtZTtcbiAgbmFtZS5jbGFzc05hbWUgPSAncmV2aWV3LW5hbWUnO1xuICBuYW1lLnNldEF0dHJpYnV0ZSgndGFiaW5kZXgnLCAnMCcpO1xuXG4gIGRpdi5hcHBlbmQobmFtZSk7XG5cbiAgY29uc3QgZGF0ZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3AnKTtcbiAgZGF0ZS5pbm5lckhUTUwgPSBuZXcgRGF0ZShyZXZpZXcudXBkYXRlZEF0KS50b0RhdGVTdHJpbmcoKTtcbiAgZGF0ZS5jbGFzc05hbWUgPSAncmV2aWV3LWRhdGUnO1xuICBkYXRlLnNldEF0dHJpYnV0ZSgndGFiaW5kZXgnLCAnMCcpO1xuXG4gIGRpdi5hcHBlbmQoZGF0ZSk7XG4gIGxpLmFwcGVuZChkaXYpO1xuXG4gIGNvbnN0IHJhdGluZyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3AnKTtcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IHJldmlldy5yYXRpbmc7IGkrKykge1xuICAgIGNvbnN0IGljb24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpJyk7XG4gICAgaWNvbi5jbGFzc05hbWUgPSAnZmFzIGZhLXN0YXInO1xuICAgIHJhdGluZy5hcHBlbmQoaWNvbik7XG4gIH1cblxuICBsaS5hcHBlbmQocmF0aW5nKTtcblxuICBjb25zdCBjb21tZW50cyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3AnKTtcbiAgY29tbWVudHMuaW5uZXJIVE1MID0gcmV2aWV3LmNvbW1lbnRzO1xuICBjb21tZW50cy5zZXRBdHRyaWJ1dGUoJ3RhYmluZGV4JywgJzAnKTtcbiAgbGkuYXBwZW5kKGNvbW1lbnRzKTtcblxuICByZXR1cm4gbGk7XG59O1xuXG4vKipcbiAgICogQHNob3cgbWVzc2FnZXMgYW5kIGhpZGUgd2hlbiB0aGUgYnV0dG9uIGlzIGNsaWNrZWRcbiAgICovXG5sZXQgc2hvd01lc3NhZ2UgPSAoKSA9PiB7XG4gIGxldCBtb2RhbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdtb2RhbC1vdmVybGF5Jyk7XG4gIGxldCBtb2RhbE1lc3NhZ2UgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbW9kYWwtbWVzc2FnZScpO1xuXG4gIG1vZGFsTWVzc2FnZS5pbm5lckhUTUwgPSAnWW91IGFyZSBvZmZsaW5lIHJpZ2h0IG5vdywgdGhlIHJldmlldyB3aWxsIGJlIHNlbnQgd2hlbiB5b3UgYXJlIG9ubGluZSBsYXRlcic7XG4gIG1vZGFsLnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xuXG4gIGxldCBidXR0b24gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYnR0bi1jbG9zZScpO1xuICBidXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBmdW5jdGlvbigpIHtcbiAgICBtb2RhbC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICB9KTtcbn07XG5cbi8qKlxuICogQHN1Ym1pdCB0aGUgZm9ybSwgc2VuZCB0byB0aGUgc2VydmVyLCBhbmQgc2hvdyBpdCBvbiBhIHBhZ2VcbiAqL1xuXG5jb25zdCBmb3JtID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Jldmlldy1mb3JtJyk7XG5cbmZvcm0uYWRkRXZlbnRMaXN0ZW5lcignc3VibWl0JywgZnVuY3Rpb24oZSkge1xuICBlLnByZXZlbnREZWZhdWx0KCk7XG4gIGxldCByZXZpZXcgPSB7XG4gICAgJ3Jlc3RhdXJhbnRfaWQnOiBzZWxmLnJlc3RhdXJhbnQuaWRcbiAgfTtcbiAgY29uc3QgZm9ybURhdGEgPSBuZXcgRm9ybURhdGEoZm9ybSk7XG4gIGZvciAobGV0IFtrZXksIHZhbHVlXSBvZiBmb3JtRGF0YS5lbnRyaWVzKCkpIHtcbiAgICByZXZpZXdba2V5XSA9IHZhbHVlO1xuICB9XG4gIGlmICghbmF2aWdhdG9yLm9uTGluZSkge1xuICAgIHNob3dNZXNzYWdlKCk7XG4gIH1cbiAgREJIZWxwZXIuY3JlYXRlUmVzdGF1cmFudFJldmlldyhyZXZpZXcpXG4gICAgLnRoZW4oKCkgPT4ge1xuICAgICAgZm9ybS5yZXNldCgpO1xuICAgICAgREJIZWxwZXIuZmV0Y2hSZXN0YXVyYW50UmV2aWV3cyhzZWxmLnJlc3RhdXJhbnQsIChlcnJvciwgcmV2aWV3cykgPT4ge1xuICAgICAgICBpZiAoIXJldmlld3MpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhlcnJvcik7XG4gICAgICAgIH1cbiAgICAgICAgZmlsbFJldmlld3NIVE1MKHJldmlld3MpO1xuICAgICAgfSk7XG4gICAgfSlcbiAgICAuY2F0Y2goZXJyb3IgPT4gY29uc29sZS5lcnJvcignZXJyJywgZXJyb3IpKTtcbn0pO1xuXG5cbiIsIid1c2Ugc3RyaWN0JztcblxuKGZ1bmN0aW9uKCkge1xuICBmdW5jdGlvbiB0b0FycmF5KGFycikge1xuICAgIHJldHVybiBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcnIpO1xuICB9XG5cbiAgZnVuY3Rpb24gcHJvbWlzaWZ5UmVxdWVzdChyZXF1ZXN0KSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgcmVxdWVzdC5vbnN1Y2Nlc3MgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmVzb2x2ZShyZXF1ZXN0LnJlc3VsdCk7XG4gICAgICB9O1xuXG4gICAgICByZXF1ZXN0Lm9uZXJyb3IgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgcmVqZWN0KHJlcXVlc3QuZXJyb3IpO1xuICAgICAgfTtcbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHByb21pc2lmeVJlcXVlc3RDYWxsKG9iaiwgbWV0aG9kLCBhcmdzKSB7XG4gICAgdmFyIHJlcXVlc3Q7XG4gICAgdmFyIHAgPSBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgIHJlcXVlc3QgPSBvYmpbbWV0aG9kXS5hcHBseShvYmosIGFyZ3MpO1xuICAgICAgcHJvbWlzaWZ5UmVxdWVzdChyZXF1ZXN0KS50aGVuKHJlc29sdmUsIHJlamVjdCk7XG4gICAgfSk7XG5cbiAgICBwLnJlcXVlc3QgPSByZXF1ZXN0O1xuICAgIHJldHVybiBwO1xuICB9XG5cbiAgZnVuY3Rpb24gcHJvbWlzaWZ5Q3Vyc29yUmVxdWVzdENhbGwob2JqLCBtZXRob2QsIGFyZ3MpIHtcbiAgICB2YXIgcCA9IHByb21pc2lmeVJlcXVlc3RDYWxsKG9iaiwgbWV0aG9kLCBhcmdzKTtcbiAgICByZXR1cm4gcC50aGVuKGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICBpZiAoIXZhbHVlKSByZXR1cm47XG4gICAgICByZXR1cm4gbmV3IEN1cnNvcih2YWx1ZSwgcC5yZXF1ZXN0KTtcbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHByb3h5UHJvcGVydGllcyhQcm94eUNsYXNzLCB0YXJnZXRQcm9wLCBwcm9wZXJ0aWVzKSB7XG4gICAgcHJvcGVydGllcy5mb3JFYWNoKGZ1bmN0aW9uKHByb3ApIHtcbiAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShQcm94eUNsYXNzLnByb3RvdHlwZSwgcHJvcCwge1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgIHJldHVybiB0aGlzW3RhcmdldFByb3BdW3Byb3BdO1xuICAgICAgICB9LFxuICAgICAgICBzZXQ6IGZ1bmN0aW9uKHZhbCkge1xuICAgICAgICAgIHRoaXNbdGFyZ2V0UHJvcF1bcHJvcF0gPSB2YWw7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgZnVuY3Rpb24gcHJveHlSZXF1ZXN0TWV0aG9kcyhQcm94eUNsYXNzLCB0YXJnZXRQcm9wLCBDb25zdHJ1Y3RvciwgcHJvcGVydGllcykge1xuICAgIHByb3BlcnRpZXMuZm9yRWFjaChmdW5jdGlvbihwcm9wKSB7XG4gICAgICBpZiAoIShwcm9wIGluIENvbnN0cnVjdG9yLnByb3RvdHlwZSkpIHJldHVybjtcbiAgICAgIFByb3h5Q2xhc3MucHJvdG90eXBlW3Byb3BdID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBwcm9taXNpZnlSZXF1ZXN0Q2FsbCh0aGlzW3RhcmdldFByb3BdLCBwcm9wLCBhcmd1bWVudHMpO1xuICAgICAgfTtcbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHByb3h5TWV0aG9kcyhQcm94eUNsYXNzLCB0YXJnZXRQcm9wLCBDb25zdHJ1Y3RvciwgcHJvcGVydGllcykge1xuICAgIHByb3BlcnRpZXMuZm9yRWFjaChmdW5jdGlvbihwcm9wKSB7XG4gICAgICBpZiAoIShwcm9wIGluIENvbnN0cnVjdG9yLnByb3RvdHlwZSkpIHJldHVybjtcbiAgICAgIFByb3h5Q2xhc3MucHJvdG90eXBlW3Byb3BdID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB0aGlzW3RhcmdldFByb3BdW3Byb3BdLmFwcGx5KHRoaXNbdGFyZ2V0UHJvcF0sIGFyZ3VtZW50cyk7XG4gICAgICB9O1xuICAgIH0pO1xuICB9XG5cbiAgZnVuY3Rpb24gcHJveHlDdXJzb3JSZXF1ZXN0TWV0aG9kcyhQcm94eUNsYXNzLCB0YXJnZXRQcm9wLCBDb25zdHJ1Y3RvciwgcHJvcGVydGllcykge1xuICAgIHByb3BlcnRpZXMuZm9yRWFjaChmdW5jdGlvbihwcm9wKSB7XG4gICAgICBpZiAoIShwcm9wIGluIENvbnN0cnVjdG9yLnByb3RvdHlwZSkpIHJldHVybjtcbiAgICAgIFByb3h5Q2xhc3MucHJvdG90eXBlW3Byb3BdID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBwcm9taXNpZnlDdXJzb3JSZXF1ZXN0Q2FsbCh0aGlzW3RhcmdldFByb3BdLCBwcm9wLCBhcmd1bWVudHMpO1xuICAgICAgfTtcbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIEluZGV4KGluZGV4KSB7XG4gICAgdGhpcy5faW5kZXggPSBpbmRleDtcbiAgfVxuXG4gIHByb3h5UHJvcGVydGllcyhJbmRleCwgJ19pbmRleCcsIFtcbiAgICAnbmFtZScsXG4gICAgJ2tleVBhdGgnLFxuICAgICdtdWx0aUVudHJ5JyxcbiAgICAndW5pcXVlJ1xuICBdKTtcblxuICBwcm94eVJlcXVlc3RNZXRob2RzKEluZGV4LCAnX2luZGV4JywgSURCSW5kZXgsIFtcbiAgICAnZ2V0JyxcbiAgICAnZ2V0S2V5JyxcbiAgICAnZ2V0QWxsJyxcbiAgICAnZ2V0QWxsS2V5cycsXG4gICAgJ2NvdW50J1xuICBdKTtcblxuICBwcm94eUN1cnNvclJlcXVlc3RNZXRob2RzKEluZGV4LCAnX2luZGV4JywgSURCSW5kZXgsIFtcbiAgICAnb3BlbkN1cnNvcicsXG4gICAgJ29wZW5LZXlDdXJzb3InXG4gIF0pO1xuXG4gIGZ1bmN0aW9uIEN1cnNvcihjdXJzb3IsIHJlcXVlc3QpIHtcbiAgICB0aGlzLl9jdXJzb3IgPSBjdXJzb3I7XG4gICAgdGhpcy5fcmVxdWVzdCA9IHJlcXVlc3Q7XG4gIH1cblxuICBwcm94eVByb3BlcnRpZXMoQ3Vyc29yLCAnX2N1cnNvcicsIFtcbiAgICAnZGlyZWN0aW9uJyxcbiAgICAna2V5JyxcbiAgICAncHJpbWFyeUtleScsXG4gICAgJ3ZhbHVlJ1xuICBdKTtcblxuICBwcm94eVJlcXVlc3RNZXRob2RzKEN1cnNvciwgJ19jdXJzb3InLCBJREJDdXJzb3IsIFtcbiAgICAndXBkYXRlJyxcbiAgICAnZGVsZXRlJ1xuICBdKTtcblxuICAvLyBwcm94eSAnbmV4dCcgbWV0aG9kc1xuICBbJ2FkdmFuY2UnLCAnY29udGludWUnLCAnY29udGludWVQcmltYXJ5S2V5J10uZm9yRWFjaChmdW5jdGlvbihtZXRob2ROYW1lKSB7XG4gICAgaWYgKCEobWV0aG9kTmFtZSBpbiBJREJDdXJzb3IucHJvdG90eXBlKSkgcmV0dXJuO1xuICAgIEN1cnNvci5wcm90b3R5cGVbbWV0aG9kTmFtZV0gPSBmdW5jdGlvbigpIHtcbiAgICAgIHZhciBjdXJzb3IgPSB0aGlzO1xuICAgICAgdmFyIGFyZ3MgPSBhcmd1bWVudHM7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCkudGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgY3Vyc29yLl9jdXJzb3JbbWV0aG9kTmFtZV0uYXBwbHkoY3Vyc29yLl9jdXJzb3IsIGFyZ3MpO1xuICAgICAgICByZXR1cm4gcHJvbWlzaWZ5UmVxdWVzdChjdXJzb3IuX3JlcXVlc3QpLnRoZW4oZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgICBpZiAoIXZhbHVlKSByZXR1cm47XG4gICAgICAgICAgcmV0dXJuIG5ldyBDdXJzb3IodmFsdWUsIGN1cnNvci5fcmVxdWVzdCk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfTtcbiAgfSk7XG5cbiAgZnVuY3Rpb24gT2JqZWN0U3RvcmUoc3RvcmUpIHtcbiAgICB0aGlzLl9zdG9yZSA9IHN0b3JlO1xuICB9XG5cbiAgT2JqZWN0U3RvcmUucHJvdG90eXBlLmNyZWF0ZUluZGV4ID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIG5ldyBJbmRleCh0aGlzLl9zdG9yZS5jcmVhdGVJbmRleC5hcHBseSh0aGlzLl9zdG9yZSwgYXJndW1lbnRzKSk7XG4gIH07XG5cbiAgT2JqZWN0U3RvcmUucHJvdG90eXBlLmluZGV4ID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIG5ldyBJbmRleCh0aGlzLl9zdG9yZS5pbmRleC5hcHBseSh0aGlzLl9zdG9yZSwgYXJndW1lbnRzKSk7XG4gIH07XG5cbiAgcHJveHlQcm9wZXJ0aWVzKE9iamVjdFN0b3JlLCAnX3N0b3JlJywgW1xuICAgICduYW1lJyxcbiAgICAna2V5UGF0aCcsXG4gICAgJ2luZGV4TmFtZXMnLFxuICAgICdhdXRvSW5jcmVtZW50J1xuICBdKTtcblxuICBwcm94eVJlcXVlc3RNZXRob2RzKE9iamVjdFN0b3JlLCAnX3N0b3JlJywgSURCT2JqZWN0U3RvcmUsIFtcbiAgICAncHV0JyxcbiAgICAnYWRkJyxcbiAgICAnZGVsZXRlJyxcbiAgICAnY2xlYXInLFxuICAgICdnZXQnLFxuICAgICdnZXRBbGwnLFxuICAgICdnZXRLZXknLFxuICAgICdnZXRBbGxLZXlzJyxcbiAgICAnY291bnQnXG4gIF0pO1xuXG4gIHByb3h5Q3Vyc29yUmVxdWVzdE1ldGhvZHMoT2JqZWN0U3RvcmUsICdfc3RvcmUnLCBJREJPYmplY3RTdG9yZSwgW1xuICAgICdvcGVuQ3Vyc29yJyxcbiAgICAnb3BlbktleUN1cnNvcidcbiAgXSk7XG5cbiAgcHJveHlNZXRob2RzKE9iamVjdFN0b3JlLCAnX3N0b3JlJywgSURCT2JqZWN0U3RvcmUsIFtcbiAgICAnZGVsZXRlSW5kZXgnXG4gIF0pO1xuXG4gIGZ1bmN0aW9uIFRyYW5zYWN0aW9uKGlkYlRyYW5zYWN0aW9uKSB7XG4gICAgdGhpcy5fdHggPSBpZGJUcmFuc2FjdGlvbjtcbiAgICB0aGlzLmNvbXBsZXRlID0gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICBpZGJUcmFuc2FjdGlvbi5vbmNvbXBsZXRlID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJlc29sdmUoKTtcbiAgICAgIH07XG4gICAgICBpZGJUcmFuc2FjdGlvbi5vbmVycm9yID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHJlamVjdChpZGJUcmFuc2FjdGlvbi5lcnJvcik7XG4gICAgICB9O1xuICAgICAgaWRiVHJhbnNhY3Rpb24ub25hYm9ydCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICByZWplY3QoaWRiVHJhbnNhY3Rpb24uZXJyb3IpO1xuICAgICAgfTtcbiAgICB9KTtcbiAgfVxuXG4gIFRyYW5zYWN0aW9uLnByb3RvdHlwZS5vYmplY3RTdG9yZSA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBuZXcgT2JqZWN0U3RvcmUodGhpcy5fdHgub2JqZWN0U3RvcmUuYXBwbHkodGhpcy5fdHgsIGFyZ3VtZW50cykpO1xuICB9O1xuXG4gIHByb3h5UHJvcGVydGllcyhUcmFuc2FjdGlvbiwgJ190eCcsIFtcbiAgICAnb2JqZWN0U3RvcmVOYW1lcycsXG4gICAgJ21vZGUnXG4gIF0pO1xuXG4gIHByb3h5TWV0aG9kcyhUcmFuc2FjdGlvbiwgJ190eCcsIElEQlRyYW5zYWN0aW9uLCBbXG4gICAgJ2Fib3J0J1xuICBdKTtcblxuICBmdW5jdGlvbiBVcGdyYWRlREIoZGIsIG9sZFZlcnNpb24sIHRyYW5zYWN0aW9uKSB7XG4gICAgdGhpcy5fZGIgPSBkYjtcbiAgICB0aGlzLm9sZFZlcnNpb24gPSBvbGRWZXJzaW9uO1xuICAgIHRoaXMudHJhbnNhY3Rpb24gPSBuZXcgVHJhbnNhY3Rpb24odHJhbnNhY3Rpb24pO1xuICB9XG5cbiAgVXBncmFkZURCLnByb3RvdHlwZS5jcmVhdGVPYmplY3RTdG9yZSA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBuZXcgT2JqZWN0U3RvcmUodGhpcy5fZGIuY3JlYXRlT2JqZWN0U3RvcmUuYXBwbHkodGhpcy5fZGIsIGFyZ3VtZW50cykpO1xuICB9O1xuXG4gIHByb3h5UHJvcGVydGllcyhVcGdyYWRlREIsICdfZGInLCBbXG4gICAgJ25hbWUnLFxuICAgICd2ZXJzaW9uJyxcbiAgICAnb2JqZWN0U3RvcmVOYW1lcydcbiAgXSk7XG5cbiAgcHJveHlNZXRob2RzKFVwZ3JhZGVEQiwgJ19kYicsIElEQkRhdGFiYXNlLCBbXG4gICAgJ2RlbGV0ZU9iamVjdFN0b3JlJyxcbiAgICAnY2xvc2UnXG4gIF0pO1xuXG4gIGZ1bmN0aW9uIERCKGRiKSB7XG4gICAgdGhpcy5fZGIgPSBkYjtcbiAgfVxuXG4gIERCLnByb3RvdHlwZS50cmFuc2FjdGlvbiA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBuZXcgVHJhbnNhY3Rpb24odGhpcy5fZGIudHJhbnNhY3Rpb24uYXBwbHkodGhpcy5fZGIsIGFyZ3VtZW50cykpO1xuICB9O1xuXG4gIHByb3h5UHJvcGVydGllcyhEQiwgJ19kYicsIFtcbiAgICAnbmFtZScsXG4gICAgJ3ZlcnNpb24nLFxuICAgICdvYmplY3RTdG9yZU5hbWVzJ1xuICBdKTtcblxuICBwcm94eU1ldGhvZHMoREIsICdfZGInLCBJREJEYXRhYmFzZSwgW1xuICAgICdjbG9zZSdcbiAgXSk7XG5cbiAgLy8gQWRkIGN1cnNvciBpdGVyYXRvcnNcbiAgLy8gVE9ETzogcmVtb3ZlIHRoaXMgb25jZSBicm93c2VycyBkbyB0aGUgcmlnaHQgdGhpbmcgd2l0aCBwcm9taXNlc1xuICBbJ29wZW5DdXJzb3InLCAnb3BlbktleUN1cnNvciddLmZvckVhY2goZnVuY3Rpb24oZnVuY05hbWUpIHtcbiAgICBbT2JqZWN0U3RvcmUsIEluZGV4XS5mb3JFYWNoKGZ1bmN0aW9uKENvbnN0cnVjdG9yKSB7XG4gICAgICAvLyBEb24ndCBjcmVhdGUgaXRlcmF0ZUtleUN1cnNvciBpZiBvcGVuS2V5Q3Vyc29yIGRvZXNuJ3QgZXhpc3QuXG4gICAgICBpZiAoIShmdW5jTmFtZSBpbiBDb25zdHJ1Y3Rvci5wcm90b3R5cGUpKSByZXR1cm47XG5cbiAgICAgIENvbnN0cnVjdG9yLnByb3RvdHlwZVtmdW5jTmFtZS5yZXBsYWNlKCdvcGVuJywgJ2l0ZXJhdGUnKV0gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIGFyZ3MgPSB0b0FycmF5KGFyZ3VtZW50cyk7XG4gICAgICAgIHZhciBjYWxsYmFjayA9IGFyZ3NbYXJncy5sZW5ndGggLSAxXTtcbiAgICAgICAgdmFyIG5hdGl2ZU9iamVjdCA9IHRoaXMuX3N0b3JlIHx8IHRoaXMuX2luZGV4O1xuICAgICAgICB2YXIgcmVxdWVzdCA9IG5hdGl2ZU9iamVjdFtmdW5jTmFtZV0uYXBwbHkobmF0aXZlT2JqZWN0LCBhcmdzLnNsaWNlKDAsIC0xKSk7XG4gICAgICAgIHJlcXVlc3Qub25zdWNjZXNzID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgY2FsbGJhY2socmVxdWVzdC5yZXN1bHQpO1xuICAgICAgICB9O1xuICAgICAgfTtcbiAgICB9KTtcbiAgfSk7XG5cbiAgLy8gcG9seWZpbGwgZ2V0QWxsXG4gIFtJbmRleCwgT2JqZWN0U3RvcmVdLmZvckVhY2goZnVuY3Rpb24oQ29uc3RydWN0b3IpIHtcbiAgICBpZiAoQ29uc3RydWN0b3IucHJvdG90eXBlLmdldEFsbCkgcmV0dXJuO1xuICAgIENvbnN0cnVjdG9yLnByb3RvdHlwZS5nZXRBbGwgPSBmdW5jdGlvbihxdWVyeSwgY291bnQpIHtcbiAgICAgIHZhciBpbnN0YW5jZSA9IHRoaXM7XG4gICAgICB2YXIgaXRlbXMgPSBbXTtcblxuICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUpIHtcbiAgICAgICAgaW5zdGFuY2UuaXRlcmF0ZUN1cnNvcihxdWVyeSwgZnVuY3Rpb24oY3Vyc29yKSB7XG4gICAgICAgICAgaWYgKCFjdXJzb3IpIHtcbiAgICAgICAgICAgIHJlc29sdmUoaXRlbXMpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpdGVtcy5wdXNoKGN1cnNvci52YWx1ZSk7XG5cbiAgICAgICAgICBpZiAoY291bnQgIT09IHVuZGVmaW5lZCAmJiBpdGVtcy5sZW5ndGggPT0gY291bnQpIHtcbiAgICAgICAgICAgIHJlc29sdmUoaXRlbXMpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICBjdXJzb3IuY29udGludWUoKTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9O1xuICB9KTtcblxuICB2YXIgZXhwID0ge1xuICAgIG9wZW46IGZ1bmN0aW9uKG5hbWUsIHZlcnNpb24sIHVwZ3JhZGVDYWxsYmFjaykge1xuICAgICAgdmFyIHAgPSBwcm9taXNpZnlSZXF1ZXN0Q2FsbChpbmRleGVkREIsICdvcGVuJywgW25hbWUsIHZlcnNpb25dKTtcbiAgICAgIHZhciByZXF1ZXN0ID0gcC5yZXF1ZXN0O1xuXG4gICAgICBpZiAocmVxdWVzdCkge1xuICAgICAgICByZXF1ZXN0Lm9udXBncmFkZW5lZWRlZCA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgICAgaWYgKHVwZ3JhZGVDYWxsYmFjaykge1xuICAgICAgICAgICAgdXBncmFkZUNhbGxiYWNrKG5ldyBVcGdyYWRlREIocmVxdWVzdC5yZXN1bHQsIGV2ZW50Lm9sZFZlcnNpb24sIHJlcXVlc3QudHJhbnNhY3Rpb24pKTtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBwLnRoZW4oZnVuY3Rpb24oZGIpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBEQihkYik7XG4gICAgICB9KTtcbiAgICB9LFxuICAgIGRlbGV0ZTogZnVuY3Rpb24obmFtZSkge1xuICAgICAgcmV0dXJuIHByb21pc2lmeVJlcXVlc3RDYWxsKGluZGV4ZWREQiwgJ2RlbGV0ZURhdGFiYXNlJywgW25hbWVdKTtcbiAgICB9XG4gIH07XG5cbiAgaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSBleHA7XG4gICAgbW9kdWxlLmV4cG9ydHMuZGVmYXVsdCA9IG1vZHVsZS5leHBvcnRzO1xuICB9XG4gIGVsc2Uge1xuICAgIHNlbGYuaWRiID0gZXhwO1xuICB9XG59KCkpO1xuIl19
