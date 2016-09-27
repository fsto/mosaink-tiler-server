all: clean_tile_server clean_tile_worker build_tile_server build_tile_worker
build: build_tile_server build_tile_worker
push: push_tile_server push_tile_worker
run: run_tile_server run_tile_worker
restart: restart_tile_server restart_tile_worker
clean: clean_tile_server clean_tile_worker

build_tile_server:
	cd tile_server; make build

build_tile_worker:
	cd tile_worker; make build

push_tile_server:
	cd tile_server; make push

push_tile_worker:
	cd tile_worker; make push

run_tile_server:
	cd tile_server; make run

run_tile_worker:
	cd tile_worker; make run

restart_tile_server:
	cd tile_server; make restart

restart_tile_worker:
	cd tile_worker; make restart

clean_tile_server:
	cd tile_server; make clean

clean_tile_worker:
	cd tile_worker; make clean
