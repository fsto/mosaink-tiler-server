var grunt = require("grunt");
grunt.loadNpmTasks("grunt-aws-lambda");


var functionName = "ImageTiler";

grunt.initConfig({
   lambda_invoke: {
      default: {
         options: {
            file_name: "index.js"
         }
      }
   },
   lambda_deploy: {
      default: {
         arn: 'arn:aws:lambda:eu-west-1:793104445705:function:ImageTiler',
         options: {
            region: 'eu-west-1',
            timeout: 300,
            memory: 1536
         }
      }
   },
   lambda_package: {
      default: {
         options: {
            // Task-specific options go here.
         }
      }
   }
});

grunt.registerTask("deploy", ["lambda_package", "lambda_deploy"])
