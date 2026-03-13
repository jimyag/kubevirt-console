.PHONY: build-ui build-go build clean image

BINARY_NAME=kubevirt-dashboard
IMAGE=ghcr.io/jimyag/kubevirt-dashboard
GIT_TAG?=$(shell git describe --tags --always)
BUILD_TIME?=$(shell date "+%Y-%m-%dT%H:%M:%S%z")
LDFLAGS=-s -w -X github.com/jimmicro/version.GitTag=$(GIT_TAG) -X github.com/jimmicro/version.BuildTime=$(BUILD_TIME)

build: build-ui build-go

build-ui:
	cd ui && bun run build

build-go:
	go build -ldflags "$(LDFLAGS)" -o $(BINARY_NAME) .

image:
	docker build --build-arg GIT_TAG=$(GIT_TAG) --build-arg BUILD_TIME=$(BUILD_TIME) -t $(IMAGE):latest .

clean:
	rm -f $(BINARY_NAME)
	rm -rf ui/dist
