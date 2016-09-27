// dependencies
var jackrabbit = require('jackrabbit');
var express = require('express');
var bodyParser = require('body-parser')


var http_port = process.env.PORT || 8080; // process.env.PORT lets the port be set by Heroku
var app = express();
var jackrabbit_url = process.env.CLOUDAMQP_URL || 'amqp://localhost';
var rabbit = jackrabbit(jackrabbit_url);
var exchange = rabbit.default();


// Express middleware for json parsing
app.use(bodyParser.json({limit: '50mb'}));


/*
 * Web server
 */
app.post('/', function (req, res) {
  try {
    var image_url_matrix = req.body.image_url_matrix;
    var parse_order_id = req.body.parse_order_id;
    var is_prod = req.body.is_prod;
    console.log("Got request to queue rendering with data:");
    console.log(req.body);
    console.log("Queuing image tile...");
    exchange.publish(
      {
        image_url_matrix: image_url_matrix,
        parse_order_id: parse_order_id,
        is_prod: is_prod
      },
      {key: 'tile_task_queue'}
    );
    res.status(202);
    res.send({status: "Tiling image"})
  } catch (err) {
    res.status(400);
    res.send({error: "Failed to extract json key `image_url_matrix`"});
  }
  // exchange.on('drain', process.exit);
});


var web_server = app.listen(http_port, function () {
  var host = web_server.address().address;
  var port = web_server.address().port;

  console.log('Example app listening at http://%s:%s', host, port);
});
