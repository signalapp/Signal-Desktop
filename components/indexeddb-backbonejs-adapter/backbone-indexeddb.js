(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['backbone', 'underscore'], factory);
    } else if (typeof exports === 'object') {
        // Node. Does not work with strict CommonJS, but
        // only CommonJS-like environments that support module.exports,
        // like Node.
        module.exports = factory(require('backbone'), require('underscore'));
    } else {
        // Browser globals (root is window)
        root.returnExports = factory(root.Backbone, root._);
    }
}(this, function (Backbone, _) {

    // Generate four random hex digits.
    function S4() {
        return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
    }

    // Generate a pseudo-GUID by concatenating random hexadecimal.
    function guid() {
        return (S4() + S4() + "-" + S4() + "-" + S4() + "-" + S4() + "-" + S4() + S4() + S4());
    }

    if ( _(indexedDB).isUndefined() ) { return; }
    
    var Deferred = Backbone.$ && Backbone.$.Deferred;

    // Driver object
    // That's the interesting part.
    // There is a driver for each schema provided. The schema is a te combination of name (for the database), a version as well as migrations to reach that
    // version of the database.
    function Driver(schema, ready, nolog, onerror) {
        this.schema         = schema;
        this.ready          = ready;
        this.error          = null;
        this.transactions   = []; // Used to list all transactions and keep track of active ones.
        this.db             = null;
        this.nolog          = nolog;
        this.onerror        = onerror;
        var lastMigrationPathVersion = _.last(this.schema.migrations).version;
        if (!this.nolog) debugLog("opening database " + this.schema.id + " in version #" + lastMigrationPathVersion);
        this.dbRequest      = indexedDB.open(this.schema.id,lastMigrationPathVersion); //schema version need to be an unsigned long

        this.launchMigrationPath = function(dbVersion) {
            var transaction = this.dbRequest.transaction;
            var clonedMigrations = _.clone(schema.migrations);
            this.migrate(transaction, clonedMigrations, dbVersion, {
                error: function (event) {
                    this.error = "Database not up to date. " + dbVersion + " expected was " + lastMigrationPathVersion;
                }.bind(this)
            });
        };

        this.dbRequest.onblocked = function(event){
            if (!this.nolog) debugLog("connection to database blocked");
        }

        this.dbRequest.onsuccess = function (e) {
            this.db = e.target.result; // Attach the connection ot the queue.
            var currentIntDBVersion = (parseInt(this.db.version) ||  0); // we need convert beacuse chrome store in integer and ie10 DP4+ in int;
            var lastMigrationInt = (parseInt(lastMigrationPathVersion) || 0);  // And make sure we compare numbers with numbers.

            if (currentIntDBVersion === lastMigrationInt) { //if support new event onupgradeneeded will trigger the ready function
                // No migration to perform!
                this.ready();
            } else if (currentIntDBVersion < lastMigrationInt ) {
                // We need to migrate up to the current migration defined in the database
                this.launchMigrationPath(currentIntDBVersion);
            } else {
                // Looks like the IndexedDB is at a higher version than the current driver schema.
                this.error = "Database version is greater than current code " + currentIntDBVersion + " expected was " + lastMigrationInt;
            }
        }.bind(this);



        this.dbRequest.onerror = function (e) {
            // Failed to open the database
            this.error = "Couldn't not connect to the database"
            if (!this.nolog) debugLog("Couldn't not connect to the database");
            this.onerror();
        }.bind(this);

        this.dbRequest.onabort = function (e) {
            // Failed to open the database
            this.error = "Connection to the database aborted"
            if (!this.nolog) debugLog("Connection to the database aborted");
            this.onerror();
        }.bind(this);



        this.dbRequest.onupgradeneeded = function(iDBVersionChangeEvent){
            this.db =iDBVersionChangeEvent.target.result;

            var newVersion = iDBVersionChangeEvent.newVersion;
            var oldVersion = iDBVersionChangeEvent.oldVersion;

            // Fix Safari 8 and iOS 8 bug
            // at the first connection oldVersion is equal to 9223372036854776000
            // but the real value is 0
            if (oldVersion > 99999999999)
                oldVersion = 0;

            if (!this.nolog) debugLog("onupgradeneeded = " + oldVersion + " => " + newVersion);
            this.launchMigrationPath(oldVersion);
        }.bind(this);
    }

    function debugLog(str) {
        if (typeof window !== "undefined" && typeof window.console !== "undefined" && typeof window.console.log !== "undefined") {
            window.console.log(str);
        }
        else if(console.log !== "undefined") {
            console.log(str)
        }
    }

    // Driver Prototype
    Driver.prototype = {

        // Tracks transactions. Mostly for debugging purposes. TO-IMPROVE
        _track_transaction: function(transaction) {
            this.transactions.push(transaction);
            function removeIt() {
                var idx = this.transactions.indexOf(transaction);
                if (idx !== -1) {this.transactions.splice(idx); }
            };
            transaction.oncomplete = removeIt.bind(this);
            transaction.onabort = removeIt.bind(this);
            transaction.onerror = removeIt.bind(this);
        },

        // Performs all the migrations to reach the right version of the database.
        migrate: function (transaction, migrations, version, options) {
            transaction.onerror = options.error;
            transaction.onabort = options.error;

            if (!this.nolog) debugLog("migrate begin version from #" + version);
            var that = this;
            var migration = migrations.shift();
            if (migration) {
                if (!version || version < migration.version) {
                    // We need to apply this migration-
                    if (typeof migration.before == "undefined") {
                        migration.before = function (next) {
                            next();
                        };
                    }
                    if (typeof migration.after == "undefined") {
                        migration.after = function (next) {
                            next();
                        };
                    }
                    // First, let's run the before script
                    if (!this.nolog) debugLog("migrate begin before version #" + migration.version);
                    migration.before(function () {
                    if (!this.nolog) debugLog("migrate done before version #" + migration.version);

                        if (!this.nolog) debugLog("migrate begin migrate version #" + migration.version);

                        migration.migrate(transaction, function () {
                            if (!this.nolog) debugLog("migrate done migrate version #" + migration.version);
                            // Migration successfully appliedn let's go to the next one!
                            if (!this.nolog) debugLog("migrate begin after version #" + migration.version);
                            migration.after(function () {
                                if (!this.nolog) debugLog("migrate done after version #" + migration.version);
                                if (!this.nolog) debugLog("Migrated to " + migration.version);

                                //last modification occurred, need finish
                                if(migrations.length ==0) {
                                    if (!this.nolog) {
                                        debugLog("migrate setting transaction.oncomplete to finish version #" + migration.version);
                                        transaction.oncomplete = function() {
                                            debugLog("migrate done transaction.oncomplete version #" + migration.version);
                                            debugLog("Done migrating");
                                        }
                                    }
                                }
                                else
                                {
                                    if (!this.nolog) debugLog("migrate end from version #" + version + " to " + migration.version);
                                    that.migrate(transaction, migrations, version, options);
                                }

                            }.bind(this));
                        }.bind(this));
                    }.bind(this));
                } else {
                    // No need to apply this migration
                    if (!this.nolog) debugLog("Skipping migration " + migration.version);
                    this.migrate(transaction, migrations, version, options);
                }
            }
        },

        // This is the main method, called by the ExecutionQueue when the driver is ready (database open and migration performed)
        execute: function (storeName, method, object, options) {
            if (!this.nolog) debugLog("execute : " + method +  " on " + storeName + " for " + object.id);
            switch (method) {
            case "create":
                this.create(storeName, object, options);
                break;
            case "read":
                if (object.id || object.cid) {
                    this.read(storeName, object, options); // It's a model
                } else {
                    this.query(storeName, object, options); // It's a collection
                }
                break;
            case "update":
                this.update(storeName, object, options); // We may want to check that this is not a collection. TOFIX
                break;
            case "delete":
                if (object.id || object.cid) {
                    this.delete(storeName, object, options);
                } else {
                    this.clear(storeName, object, options);
                }
                break;
            default:
                // Hum what?
            }
        },

        // Writes the json to the storeName in db. It is a create operations, which means it will fail if the key already exists
        // options are just success and error callbacks.
        create: function (storeName, object, options) {
            var writeTransaction = this.db.transaction([storeName], 'readwrite');
            //this._track_transaction(writeTransaction);
            var store = writeTransaction.objectStore(storeName);
            var json = object.toJSON();
            var idAttribute = _.result(object, 'idAttribute');
            var writeRequest;

            if (json[idAttribute] === undefined && !store.autoIncrement) json[idAttribute] = guid();

            writeTransaction.onerror = function (e) {
                options.error(e);
            };
            writeTransaction.oncomplete = function (e) {
                options.success(json);
            };

            if (!store.keyPath)
                writeRequest = store.add(json, json[idAttribute]);
            else
                writeRequest = store.add(json);
        },

        // Writes the json to the storeName in db. It is an update operation, which means it will overwrite the value if the key already exist
        // options are just success and error callbacks.
        update: function (storeName, object, options) {
            var writeTransaction = this.db.transaction([storeName], 'readwrite');
            //this._track_transaction(writeTransaction);
            var store = writeTransaction.objectStore(storeName);
            var json = object.toJSON();
            var idAttribute = _.result(object, 'idAttribute');
            var writeRequest;

            if (!json[idAttribute]) json[idAttribute] = guid();

            if (!store.keyPath)
              writeRequest = store.put(json, json[idAttribute]);
            else
              writeRequest = store.put(json);

            writeRequest.onerror = function (e) {
                options.error(e);
            };
            writeTransaction.oncomplete = function (e) {
                options.success(json);
            };
        },

        // Reads from storeName in db with json.id if it's there of with any json.xxxx as long as xxx is an index in storeName
        read: function (storeName, object, options) {
            var readTransaction = this.db.transaction([storeName], "readonly");
            this._track_transaction(readTransaction);

            var store = readTransaction.objectStore(storeName);
            var json = object.toJSON();
            var idAttribute = _.result(object, 'idAttribute');

            var getRequest = null;
            if (json[idAttribute]) {
                getRequest = store.get(json[idAttribute]);
            } else if(options.index) {
                var index = store.index(options.index.name);
                getRequest = index.get(options.index.value);
            } else {
                // We need to find which index we have
                var cardinality = 0; // try to fit the index with most matches
                _.each(store.indexNames, function (key, index) {
                    index = store.index(key);
                    if(typeof index.keyPath === 'string' && 1 > cardinality) {
                        // simple index
                        if (json[index.keyPath] !== undefined) {
                            getRequest = index.get(json[index.keyPath]);
                            cardinality = 1;
                        }
                    } else if(typeof index.keyPath === 'object' && index.keyPath.length > cardinality) {
                        // compound index
                        var valid = true;
                        var keyValue = _.map(index.keyPath, function(keyPart) {
                            valid = valid && json[keyPart] !== undefined;
                            return json[keyPart];
                        });
                        if(valid) {
                            getRequest = index.get(keyValue);
                            cardinality = index.keyPath.length;
                        }
                    }
                });
            }
            if (getRequest) {
                getRequest.onsuccess = function (event) {
                    if (event.target.result) {
                        options.success(event.target.result);
                    } else {
                        options.error("Not Found");
                    }
                };
                getRequest.onerror = function () {
                    options.error("Not Found"); // We couldn't find the record.
                }
            } else {
                options.error("Not Found"); // We couldn't even look for it, as we don't have enough data.
            }
        },

        // Deletes the json.id key and value in storeName from db.
        delete: function (storeName, object, options) {
            var deleteTransaction = this.db.transaction([storeName], 'readwrite');
            //this._track_transaction(deleteTransaction);

            var store = deleteTransaction.objectStore(storeName);
            var json = object.toJSON();
            var idAttribute = store.keyPath || _.result(object, 'idAttribute');

            var deleteRequest = store.delete(json[idAttribute]);

            deleteTransaction.oncomplete = function (event) {
                options.success(null);
            };
            deleteRequest.onerror = function (event) {
                options.error("Not Deleted");
            };
        },

        // Clears all records for storeName from db.
        clear: function (storeName, object, options) {
            var deleteTransaction = this.db.transaction([storeName], "readwrite");
            //this._track_transaction(deleteTransaction);

            var store = deleteTransaction.objectStore(storeName);

            var deleteRequest = store.clear();
            deleteRequest.onsuccess = function (event) {
                options.success(null);
            };
            deleteRequest.onerror = function (event) {
                options.error("Not Cleared");
            };
        },

        // Performs a query on storeName in db.
        // options may include :
        // - conditions : value of an index, or range for an index
        // - range : range for the primary key
        // - limit : max number of elements to be yielded
        // - offset : skipped items.
        query: function (storeName, collection, options) {
            var elements = [];
            var skipped = 0, processed = 0;
            var queryTransaction = this.db.transaction([storeName], "readonly");
            //this._track_transaction(queryTransaction);

            var idAttribute = _.result(collection.model.prototype, 'idAttribute');
            var readCursor = null;
            var store = queryTransaction.objectStore(storeName);
            var index = null,
                lower = null,
                upper = null,
                bounds = null,
                key;

            if (options.conditions) {
                // We have a condition, we need to use it for the cursor
                _.each(store.indexNames, function (key) {
                    if (!readCursor) {
                        index = store.index(key);
                        if (options.conditions[index.keyPath] instanceof Array) {
                            lower = options.conditions[index.keyPath][0] > options.conditions[index.keyPath][1] ? options.conditions[index.keyPath][1] : options.conditions[index.keyPath][0];
                            upper = options.conditions[index.keyPath][0] > options.conditions[index.keyPath][1] ? options.conditions[index.keyPath][0] : options.conditions[index.keyPath][1];
                            bounds = IDBKeyRange.bound(lower, upper, true, true);

                            if (options.conditions[index.keyPath][0] > options.conditions[index.keyPath][1]) {
                                // Looks like we want the DESC order
                                readCursor = index.openCursor(bounds, window.IDBCursor.PREV || "prev");
                            } else {
                                // We want ASC order
                                readCursor = index.openCursor(bounds, window.IDBCursor.NEXT || "next");
                            }
                        } else if (typeof options.conditions[index.keyPath] === 'object' && ('$gt' in options.conditions[index.keyPath] || '$gte' in options.conditions[index.keyPath])) {
                            if('$gt' in options.conditions[index.keyPath])
                                bounds = IDBKeyRange.lowerBound(options.conditions[index.keyPath]['$gt'], true);
                            else
                                bounds = IDBKeyRange.lowerBound(options.conditions[index.keyPath]['$gte']);
                            readCursor = index.openCursor(bounds, window.IDBCursor.NEXT || "next");
                        } else if (typeof options.conditions[index.keyPath] === 'object' && ('$lt' in options.conditions[index.keyPath] || '$lte' in options.conditions[index.keyPath])) {
                            if('$lt' in options.conditions[index.keyPath])
                                bounds = IDBKeyRange.upperBound(options.conditions[index.keyPath]['$lt'], true);
                            else
                                bounds = IDBKeyRange.upperBound(options.conditions[index.keyPath]['$lte']);
                            readCursor = index.openCursor(bounds, window.IDBCursor.NEXT || "next");
                        } else if (options.conditions[index.keyPath] != undefined) {
                            bounds = IDBKeyRange.only(options.conditions[index.keyPath]);
                            readCursor = index.openCursor(bounds);
                        }
                    }
                });
            } else {
                // No conditions, use the index
                if (options.range) {
                    lower = options.range[0] > options.range[1] ? options.range[1] : options.range[0];
                    upper = options.range[0] > options.range[1] ? options.range[0] : options.range[1];
                    bounds = IDBKeyRange.bound(lower, upper);
                    if (options.range[0] > options.range[1]) {
                        readCursor = store.openCursor(bounds, window.IDBCursor.PREV || "prev");
                    } else {
                        readCursor = store.openCursor(bounds, window.IDBCursor.NEXT || "next");
                    }
                } else if (options.sort && options.sort.index) {
                    if (options.sort.order === -1) {
                        readCursor = store.index(options.sort.index).openCursor(null, window.IDBCursor.PREV || "prev");
                    } else {
                        readCursor = store.index(options.sort.index).openCursor(null, window.IDBCursor.NEXT || "next");
                    }
                } else {
                    readCursor = store.openCursor();
                }
            }

            if (typeof (readCursor) == "undefined" || !readCursor) {
                options.error("No Cursor");
            } else {
                readCursor.onerror = function(e){
                    options.error("readCursor error", e);
                };
                // Setup a handler for the cursor’s `success` event:
                readCursor.onsuccess = function (e) {
                    var cursor = e.target.result;
                    if (!cursor) {
                        if (options.addIndividually || options.clear) {
                            options.success(elements, true);
                        } else {
                            options.success(elements); // We're done. No more elements.
                        }
                    }
                    else {
                        // Cursor is not over yet.
                        if (options.abort || (options.limit && processed >= options.limit)) {
                            // Yet, we have processed enough elements. So, let's just skip.
                            if (bounds && options.conditions[index.keyPath]) {
                                cursor.continue(options.conditions[index.keyPath][1] + 1); /* We need to 'terminate' the cursor cleany, by moving to the end */
                            } else {
                                cursor.continue(); /* We need to 'terminate' the cursor cleany, by moving to the end */
                            }
                        }
                        else if (options.offset && options.offset > skipped) {
                            skipped++;
                            cursor.continue(); /* We need to Moving the cursor forward */
                        } else {
                            // This time, it looks like it's good!
                            if (!options.filter || typeof(options.filter) !== 'function' || options.filter(cursor.value)) {
                                if (options.addIndividually) {
                                    collection.add(cursor.value);
                                } else if (options.clear) {
                                    var deleteRequest = store.delete(cursor.value[idAttribute]);
                                    deleteRequest.onsuccess = function (event) {
                                        elements.push(cursor.value);
                                    };
                                    deleteRequest.onerror = function (event) {
                                        elements.push(cursor.value);
                                    };

                                } else {
                                    elements.push(cursor.value);
                                }
                            }
                            processed++;
                            cursor.continue();
                        }
                    }
                };
            }
        },
        close :function(){
            if(this.db){
                this.db.close();
            }
        }
    };

    // ExecutionQueue object
    // The execution queue is an abstraction to buffer up requests to the database.
    // It holds a "driver". When the driver is ready, it just fires up the queue and executes in sync.
    function ExecutionQueue(schema,next,nolog) {
        this.driver     = new Driver(schema, this.ready.bind(this), nolog, this.error.bind(this));
        this.started    = false;
        this.failed     = false;
        this.stack      = [];
        this.version    = _.last(schema.migrations).version;
        this.next       = next;
    }

    // ExecutionQueue Prototype
    ExecutionQueue.prototype = {
        // Called when the driver is ready
        // It just loops over the elements in the queue and executes them.
        ready: function () {
            this.started = true;
            _.each(this.stack, function (message) {
                this.execute(message);
            }.bind(this));
            this.stack = [];    // fix memory leak
            this.next();
        },

        error: function() {
            this.failed = true;
            _.each(this.stack, function (message) {
                this.execute(message);
            }.bind(this));
            this.stack = [];
            this.next();
        },

        // Executes a given command on the driver. If not started, just stacks up one more element.
        execute: function (message) {
            if (this.started) {
                this.driver.execute(message[2].storeName || message[1].storeName, message[0], message[1], message[2]); // Upon messages, we execute the query
            } else if (this.failed) {
                message[2].error();
            } else {
                this.stack.push(message);
            }
        },

        close : function(){
            this.driver.close();
        }
    };

    // Method used by Backbone for sync of data with data store. It was initially designed to work with "server side" APIs, This wrapper makes
    // it work with the local indexedDB stuff. It uses the schema attribute provided by the object.
    // The wrapper keeps an active Executuon Queue for each "schema", and executes querues agains it, based on the object type (collection or
    // single model), but also the method... etc.
    // Keeps track of the connections
    var Databases = {};

    function sync(method, object, options) {

        if(method == "closeall"){
            _.each(Databases,function(database){
                database.close();
            });
            // Clean up active databases object.
            Databases = {};
            return Deferred && Deferred().resolve();
        }

        // If a model or a collection does not define a database, fall back on ajaxSync
        if (!object || !_.isObject(object.database)) {
            return Backbone.ajaxSync(method, object, options);
        }

        var schema = object.database;
        if (Databases[schema.id]) {
            if(Databases[schema.id].version != _.last(schema.migrations).version){
                Databases[schema.id].close();
                delete Databases[schema.id];
            }
        }

        var dfd, promise;
        if (Deferred) {
            dfd = Deferred();
            promise = dfd.promise();
            promise.abort = function () {
                options.abort = true;
            };
        }

        var success = options.success;
        options.success = function(resp, silenced) {
            if (!silenced) {
                if (success) success(resp);
                object.trigger('sync', object, resp, options);
            }
            if (dfd) {
                if (!options.abort) {
                    dfd.resolve(resp);
                } else {
                    dfd.reject();
                }
            }
        };

        var error = options.error;
        options.error = function(resp) {
            if (error) error(resp);
            if (dfd) dfd.reject(resp);
            object.trigger('error', object, resp, options);
        };

        var next = function(){
            Databases[schema.id].execute([method, object, options]);
        };

        if (!Databases[schema.id]) {
            Databases[schema.id] = new ExecutionQueue(schema,next,schema.nolog);
        } else {
            next();
        }

        return promise;
    };

    Backbone.ajaxSync = Backbone.sync;
    Backbone.sync = sync;

    return { sync: sync, debugLog: debugLog};
}));
