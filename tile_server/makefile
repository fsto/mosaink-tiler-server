all: build

build:
	cp -r ../node_modules .
	docker build -t tile_server .

push:
	docker push tile_server

run:
	docker run -d -p 8080:8080 --name=tile_server --restart=always tile_server

restart:
	docker restart tile_server

clean:
	docker stop tile_server; docker rm tile_server
