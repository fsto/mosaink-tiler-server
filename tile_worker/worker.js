var moment = require('moment');
var _ = require('underscore');
var util = require('util');
var fs = require('fs');
var gm = require('gm').subClass({ imageMagick: true }); // Enable ImageMagick integration.
var jackrabbit = require('jackrabbit');
var request = require('request');
var async = require('async');
var AWS = require('aws-sdk');
var Parse = require('parse/node').Parse;
var queue_options = {
  name: 'tile_task_queue',
  durable: true
};
var consume_options = {
  noAck: true
};


// constants and variables
var MAX_WIDTH  = 100;
var MAX_HEIGHT = 100;
var PARSE_APPLICATION_ID_DEV = process.env.PARSE_APPLICATION_ID_DEV;
var PARSE_APPLICATION_ID_PROD = process.env.PARSE_APPLICATION_ID_PROD;
var PARSE_JAVASCRIPT_KEY_DEV = process.env.PARSE_JAVASCRIPT_KEY_DEV;
var PARSE_JAVASCRIPT_KEY_PROD = process.env.PARSE_JAVASCRIPT_KEY_PROD;
var jackrabbit_url = process.env.CLOUDAMQP_URL || 'amqp://localhost';
var rabbit = jackrabbit(jackrabbit_url);
var exchange = rabbit.default();
var s3 = new AWS.S3();                    // get reference to S3 client
var ParseOrder = Parse.Object.extend("Order");


/*
 * Task queue with RabbitMQ
 */

var onTile = function(data) {
  console.log("Got request with data:");
  console.log(data);
  console.log("Start processing...");

  var image_url_matrix = get_image_url_matrix(data);
  try {
    result = tile(image_url_matrix, data.parse_order_id, data.is_prod);
  } catch(err) {
    console.error("Failed tiling image! Got the following error:");
    console.error(err);
    console.error(err.stack);
  }
  // if (result.error) {
  //   console.error("Failed image tile: " + result.message);
  //   console.error(result.error);
  // } else {
  //   console.log("Succeeded image tile: " + result.message);
  //   ack();
  // }
};

console.log("Making rabbitmq queue ready by connecting to " + jackrabbit_url);
var tile_task_queue = exchange.queue(queue_options);
tile_task_queue.consume(onTile, consume_options);
console.log("Queue should be ready");


var get_image_url_matrix = function(data) {
  var image_url_matrix = null;

  // Extract `image_url_matrix` from data
  try {
    var image_url_matrix = data.image_url_matrix;
  } catch(err) {
    console.error("Failed to extract `image_url_matrix`");
  }

  // Validate `image_url_matrix` being an array
  if (!_.isArray(image_url_matrix)) {
    console.error("`image_url_matrix` is not an array");
    return null;
  }

  // Validate `image_url_matrix` having all rows of equal length
  var num_cols = image_url_matrix[0].length;
  var rows_with_invalid_length = _.filter(
    image_url_matrix,
    function(image_url_row) {
      return image_url_row.length !== num_cols;
    }
  );
  if (rows_with_invalid_length.length !== 0) {
    console.error(rows_with_invalid_length.length + " rows in `image_url_matrix` don't have the same length as the first row");
    return null;
  }

  // Validate all elements in `image_url_matrix` being urls
  var invalid_image_urls = _.filter(
    _.flatten(image_url_matrix),
    function(image_url) {
      return !/^(|http|https):\/\/[^ "]+$/.test(image_url);
    }
  );
  if (invalid_image_urls.length !== 0) {
    console.error("Not all elements in `image_url_matrix` are urls:");
    console.error(invalid_image_urls);
    return null;
  }

  // `image_url_matrix` seems valid, so return it
  return image_url_matrix;
};


var update_image_url = function(image_url, parse_order_id, is_prod) {
  console.log("Update Parse Order model (" + (is_prod ? "production" : "dev") + ")");
  console.log("Parse Order Model id: " + parse_order_id);
  console.log("Image url: " + image_url);
  var parse_application_id = is_prod ? PARSE_APPLICATION_ID_PROD : PARSE_APPLICATION_ID_DEV;
  var parse_javascript_key = is_prod ? PARSE_JAVASCRIPT_KEY_PROD : PARSE_JAVASCRIPT_KEY_DEV;
  // Set up parse
  Parse.initialize(parse_application_id, parse_javascript_key);

  var query = new Parse.Query(ParseOrder);
  query.get(parse_order_id)
  .then(function(parse_order_model) {
    if (!parse_order_model) {
      throw "No Parse Order model received";
    }
    console.log("Updated Parse Order model");
    parse_order_model.set("printImageUrl", image_url);
    parse_order_model.save(null);
  });
};


/*
 * Image tiler
 */
var tile = function(image_url_matrix, parse_order_id, is_prod, callback) {
  // Read options from the event.
  var image_size = 640;
  var totalImageWidth = 8268; // 7200; // 1920;
  var totalImageHeight = 8260; // 7200; // 1920;
  var outerPaddingFactor = 1.25;
  var imagePaddingFactor = 1.05;
  var background = "white";
  var num_rows = image_url_matrix.length;
  var num_cols = image_url_matrix[0].length;

  var image_urls = image_url_matrix.reduce(function(a, b) {
    return a.concat(b);
  });
  for (var i = 0; i < image_urls.length; i++) {
    image_urls[i] = {index: i, url: image_urls[i]};
  }

  //Set up our queue
  var downloadQueue = async.queue(function(data, callback) {
      //This is the queue's task function
      //It copies objectName from source- to destination bucket
      var image_url_data = data.image_url_data;
      var next = data.next;
      var index = image_url_data.index;
      var url = image_url_data.url;
      gm(request(url), index + ".jpg")
      .resize(image_size + "^", image_size + "^")
      .write("/tmp/" + index + ".jpg", function(err) {
        if (err) {
          console.log("Failed writing file:");
          console.log(err);
          callback(err);
          next(err);
        }
        else {
          callback();
        }
      });
      // request(url)
      //   .pipe(fs.createWriteStream(index + ".jpg"))
      //   .on('close', done);
  }, 20); //Only allow 20 copy requests at a time
  //When the queue is emptied we want to check if we're done
  /*downloadQueue.drain = function() {
      checkDone();
  };*/

  // Download the image from S3, transform, and upload to a different S3 bucket.
  async.waterfall([
    function download(next) {
      console.log("Downloading images...")
      downloadQueue.drain = next;
      _.each(image_urls, function(image_url_data) {
        downloadQueue.push({image_url_data: image_url_data, next: next});
      });
    },
    function tile(next) {
      console.log("Tiling...");
      var canvas = gm();
      var a = [];
      for (var i = 0; i < num_rows * num_cols; i++) {
        a.push(i);
      }

      async.each(a, function(image_i, done) {
        var row_i = Math.floor(image_i / num_cols);
        var col_i = image_i % num_cols;
        var offset_x = image_size * col_i * imagePaddingFactor;
        var offset_y = image_size * row_i * imagePaddingFactor;
        // http://stackoverflow.com/questions/17369842/tile-four-images-together-using-node-js-and-graphicsmagick
        canvas.in("-page", "+" + offset_x + "+" + offset_y);
        canvas.in("/tmp/" + image_i + ".jpg");
        done();
      }, function() {
        next(null, canvas);
      });
    },
    function resize (canvas, next) {
      console.log("Resizing...");
      canvasWidth = totalImageWidth * outerPaddingFactor;
      canvasHeight = totalImageHeight * outerPaddingFactor;
      canvas = canvas.background(background)
        .setFormat('jpeg')
        .gravity('Center')
        .mosaic()
        .resize(totalImageWidth, totalImageHeight)
        .extent(canvasWidth, canvasHeight)
        /*.write('output.jpg', function (err) {
          if (err) next(err);
        });*/
        .toBuffer(function(err, buffer) {
          if (err) {
            // next(null, "image/jpeg", buffer);
            console.log("Resize / placement issue:");
            console.log(typeof err);
            console.log(err);
            next(err);
          }
          else {
            next(null, "image/jpeg", buffer);
          }
        });
    },
    function upload(contentType, data, next) {
      console.log("Uploading...");
      var bucket_name = "fsto-test";
      var filename = moment().format("YYYY-MM-DD-HH-mm-ss") + ".jpg"
      var image_url = "https://" + bucket_name + ".s3.amazonaws.com/" + filename;
      // Stream the transformed image to a different S3 bucket.
      s3.putObject({
        Bucket: bucket_name,
        Key: filename,
        Body: data,
        ContentType: contentType,
        ACL: 'public-read'
      },
      function(err, data) {
        if (err) {
          console.log("Failed uploading image to S3");
          console.log(err, err.stack);
        }
        else {
          console.log(data);
          update_image_url(image_url, parse_order_id, is_prod);
        }

        next();
      });
    },
  ],
  function (err) {
     if (err) {
        console.error("Failed to bulid image du to an error: " + err);
     } else {
        console.log('Successfully built and uploaded image');
        if (typeof callback !== 'undefined') {
          callback();
        }
     }
    // return {error: err, message: msg};
  });
};
