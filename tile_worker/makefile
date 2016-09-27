all: build

build:
	cp -r ../node_modules .
	docker build -t tile_worker .

push:
	docker push tile_worker

run:
	docker run -d --name=tile_worker --restart=always tile_worker


restart:
	docker restart tile_server

clean:
	docker stop tile_worker; docker rm tile_worker
