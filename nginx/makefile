all: build

build:
	docker build -t mosaink_proxy .

run:
	docker run -d -p 80:80 --name=mosaink_proxy --link tile_server:tile_server --restart=always mosaink_proxy

restart:
	docker restart mosaink_proxy

clean:
	docker stop mosaink_proxy; docker rm mosaink_proxy
