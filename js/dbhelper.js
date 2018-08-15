'use strict';

import idb from 'idb';

/**
 * Common database helper functions.
 */

class DBHelper {
  /**
   * Database URL.
   * Change this to restaurants.json file location on your server.
   */
  static get DATABASE_URL() {
    const port = 1337;// Change this to your server port
    return `http://localhost:${port}`;
  }

  /**
   * @open database to store data retrieved from the server in indexedDB API
   */
  static openDatabase() {
    if (!navigator.serviceWorker) {
      return Promise.resolve();
    } else {
      return idb.open('restaurants', 3, (upgradeDb) => {
        upgradeDb.createObjectStore('restaurants', { keyPath: 'id' });
        let reviewStore = upgradeDb.createObjectStore('reviews', { keyPath: 'id' });
        reviewStore.createIndex('restaurant_id', 'restaurant_id', {unique: false});
        upgradeDb.createObjectStore('offline-reviews', { keyPath: 'updatedAt' });
      });
    }
  }
  /**
   * @get data from a store in IndexedDB if it is available
   */
  static getCachedIndexedDB(store_name) {
    let dbPromise = DBHelper.openDatabase();

    return dbPromise.then(function(db) {
      if(!db) return;
      let tx = db.transaction(store_name);
      let store = tx.objectStore(store_name);
      return store.getAll();
    });
  }

  /**
   * @store the data in IndexedDB after fetching it from the server
   * @param datas: are retrieved from IndexedDB or the server, store_name: {string}
   */
  static storeDataIndexedDb(datas, store_name) {
    let dbPromise = DBHelper.openDatabase();

    dbPromise.then(db => {
      if (!db) return;
      const tx = db.transaction(store_name, 'readwrite');
      const store = tx.objectStore(store_name);

      datas.forEach(data => {
        store.put(data);
      });
    });
  }
  /**
   * @fetch all restaurants form IndexedDB if they exist otherwise fetch from the server.
   */
  static fetchRestaurants(callback) {
    //check if data exists in indexDB API if it does return callback
    DBHelper.getCachedIndexedDB('restaurants').then(results => {
      if (results && results.length > 0) {
        callback(null, results);
      }
      fetch(`${DBHelper.DATABASE_URL}/restaurants`)
        .then(response => response.json())
        .then(restaurants => {
          //store data in indexDB API after fetching
          DBHelper.storeDataIndexedDb(restaurants, 'restaurants');
          callback(null, restaurants);
        })
        .catch(err => {
          callback(err , null);
        });
    });
  }
  /**
   * @fetch all reviews form IndexedDB if they exist otherwise fetch from the server.
   */
  static fetchRestaurantReviews(restaurant, callback) {
    let dbPromise = DBHelper.openDatabase();

    dbPromise.then(db => {
      if (!db) return;
      const tx = db.transaction('reviews');
      const store = tx.objectStore('reviews');
      const index = store.index('restaurant_id');

      index.getAll(restaurant.id).then(results => {
        console.log('reviews', results);
        callback(null, results);

        if (!navigator.onLine) {
          return;
        }

        fetch(`${DBHelper.DATABASE_URL}/reviews/?restaurant_id=${restaurant.id}`)
          .then(response => {
            return response.json();
          })
          .then(reviews => {
            //store data in indexDB API after fetching
            DBHelper.storeDataIndexedDb(reviews, 'reviews');
            callback(null, reviews);
          })
          .catch(err => {
            callback(err , null);
          });
      });
    });
  }

  /**
   * @fetch a restaurant by its ID.
   */
  static fetchRestaurantById(id, callback) {
    // fetch all restaurants with proper error handling.
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        const restaurant = restaurants.find(r => r.id == id);
        if (restaurant) { // Got the restaurant
          callback(null, restaurant);
        } else { // Restaurant does not exist in the database
          callback('Restaurant does not exist', null);
        }
      }
    });
  }

  /**
   * @fetch restaurants by a cuisine type with proper error handling.
   */
  static fetchRestaurantByCuisine(cuisine, callback) {
    // Fetch all restaurants  with proper error handling
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Filter restaurants to have only given cuisine type
        const results = restaurants.filter(r => r.cuisine_type == cuisine);
        callback(null, results);
      }
    });
  }

  /**
   * @fetch restaurants by a neighborhood with proper error handling.
   */
  static fetchRestaurantByNeighborhood(neighborhood, callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Filter restaurants to have only given neighborhood
        const results = restaurants.filter(r => r.neighborhood == neighborhood);
        callback(null, results);
      }
    });
  }

  /**
   * @fetch restaurants by a cuisine and a neighborhood with proper error handling.
   */
  static fetchRestaurantByCuisineAndNeighborhood(cuisine, neighborhood, callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        let results = restaurants;
        if (cuisine != 'all') { // filter by cuisine
          results = results.filter(r => r.cuisine_type == cuisine);
        }
        if (neighborhood != 'all') { // filter by neighborhood
          results = results.filter(r => r.neighborhood == neighborhood);
        }
        callback(null, results);
      }
    });
  }

  /**
   * @fetch all neighborhoods with proper error handling.
   */
  static fetchNeighborhoods(callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Get all neighborhoods from all restaurants
        const neighborhoods = restaurants.map((v, i) => restaurants[i].neighborhood);
        // Remove duplicates from neighborhoods
        const uniqueNeighborhoods = neighborhoods.filter((v, i) => neighborhoods.indexOf(v) == i);
        callback(null, uniqueNeighborhoods);
      }
    });
  }

  /**
   * @fetch all cuisines with proper error handling.
   */
  static fetchCuisines(callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Get all cuisines from all restaurants
        const cuisines = restaurants.map((v, i) => restaurants[i].cuisine_type);
        // Remove duplicates from cuisines
        const uniqueCuisines = cuisines.filter((v, i) => cuisines.indexOf(v) == i);
        callback(null, uniqueCuisines);
      }
    });
  }

  /**
   * @restaurant page URL.
   */
  static urlForRestaurant(restaurant) {
    return (`./restaurant.html?id=${restaurant.id}`);
  }

  /**
   * @restaurant image URL.
   */
  static imageUrlForRestaurant(restaurant) {
    if (restaurant.photograph === undefined) {
      restaurant.photograph = 10;
    }
    return (`/img/${restaurant.photograph}.jpg`);
  }

  /**
   * @show messages and hide when the button is clicked
   */
  static showMessage() {
    let modal = document.getElementById('modal-overlay');
    modal.style.display = 'block';

    let button = document.getElementById('bttn-close');
    button.addEventListener('click', function() {
      modal.style.display = 'none';
    });
  }

  /**
   * @post review_data to the server when a user submits a review
   * online: keep it in the reviews store in IndexedDB
   * offline: keep it in the offlne-reviews in IndexedDB
   * @param review_data is from a user fills out the form
   */
  static createRestaurantReview(review_data) {

    return fetch(`${DBHelper.DATABASE_URL}/reviews`, {
      method: 'POST',
      cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
      credentials: 'same-origin',
      body: JSON.stringify(review_data),
      headers: {
        'content-type': 'application/json'
      },
      mode: 'cors',
      redirect: 'follow',
      referrer: 'no-referrer',
    })
      .then(response => {
        response.json()
          .then(review_data => {
          /* keep datas in IndexedDB after posting data to the server when online */
            console.log('review_stored', review_data);
            DBHelper.storeDataIndexedDb([review_data], 'reviews');
            return review_data;
          });
      })
      .catch(error => {
        review_data['updatedAt'] = new Date().getTime();
        console.log('review_data', review_data);
        /* keep datas in IndexedDB after posting data to the server when offline*/
        DBHelper.storeDataIndexedDb([review_data], 'offline-reviews');
        console.log('Review stored offline in IDB');
        return;
      });
  }

  /**
   * @clear data in the offline-reviews store
   */
  static clearOfflineReviews() {
    let dbPromise = DBHelper.openDatabase();
    dbPromise.then(db => {
      const tx = db.transaction('offline-reviews', 'readwrite');
      const store = tx.objectStore('offline-reviews');
      store.clear();
    });
    return;
  }

  /**
   * @get reviews from offline-stores in IndexedDB when a user go from offline to online
   */
  static createOfflineReview() {
    DBHelper.openDatabase().then(db => {
      if (!db) return;
      const tx = db.transaction('offline-reviews', 'readwrite');
      const store = tx.objectStore('offline-reviews');
      store.getAll().then(offlineReviews => {
        console.log('offlineReviews', offlineReviews);
        offlineReviews.forEach(review => {
          DBHelper.createRestaurantReview(review);
        });
        DBHelper.clearOfflineReviews();
      });
    });
  }

  /**
   * @Map marker for a restaurant.
   */
  static mapMarkerForRestaurant(restaurant, map) {
    const marker = new google.maps.Marker({
      position: restaurant.latlng,
      title: restaurant.name,
      url: DBHelper.urlForRestaurant(restaurant),
      map: map,
      animation: google.maps.Animation.DROP
    });
    return marker;
  }
}

/* create these functions to add online status to the browser
 * when it is offline it will store review submission in offline-reviews IndexedDB
*/
let onGoOnline = () => {
  console.log('Going online');
  DBHelper.createOfflineReview();
};

let onGoOffline = () => {
  console.log('Going offline');
};

window.addEventListener('online', onGoOnline);
window.addEventListener('offline', onGoOffline);

/* @register ServiceWorker to cache data for the site
   * to allow any page that has been visited is accessible offline
   */
navigator.serviceWorker.register('./sw.js').then(function(reg) {
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

let _updateReady = (worker) => {
  worker.postMessage({action: 'skipWaiting'});
};

let  _trackInstalling = (worker) => {
  let indexController = this;
  worker.addEventListener('stateChange', function() {
    if (worker.state == 'installed') {
      indexController._updateReady(worker);
    }
  });
};

export default DBHelper;
