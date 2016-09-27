FROM ubuntu:14.04

RUN apt-get update
RUN apt-get install -y software-properties-common python-software-properties
RUN add-apt-repository ppa:chris-lea/node.js
RUN apt-get update

RUN apt-get install -y nodejs
RUN npm install -g bower
RUN npm install -g grunt-cli
RUN mkdir /src

WORKDIR /src
ADD . .

EXPOSE 8080

CMD node index.js
