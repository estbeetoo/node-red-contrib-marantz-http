/**
 * Created by kycok on 11.05.2016.
 */
var connectionFSM = require('../lib/connectionFSM.js');
var connection = new connectionFSM({
    host: '192.168.2.139',
    port: 80,
    debug: true,
    'ping-interval': 1000
});
connection.connect();