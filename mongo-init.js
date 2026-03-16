// MongoDB initialization script
// Creates the logbook database and sets up indexes

db = db.getSiblingDB('logbook');

// Create indexes for RawEvent collection
db.rawevents.createIndex({ vin: 1, timestamp: -1 });
db.rawevents.createIndex({ vin: 1, name: 1, timestamp: -1 });

// Create index for Trip collection
db.trips.createIndex({ vin: 1, startTime: -1 });

// Create unique index for Vehicle
db.vehicles.createIndex({ vin: 1 }, { unique: true });

print('BMW Logbook database initialized successfully');
