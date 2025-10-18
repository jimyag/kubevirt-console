
GIT_TAG := $(shell git describe --tags --always --dirty="-dev")
BUILD_TIME := $(shell date "+%Y-%m-%dT%H:%M:%S%z")
LDFLAGS := -s -w \
	-X github.com/jimmicro/version.GitTag=$(GIT_TAG) \
	-X github.com/jimmicro/version.BuildTime=$(BUILD_TIME)

IMAGE := ghcr.io/jimyag/kubevirt-console

.PHONY: build
build: build-frontend
	go build -trimpath -v -ldflags "$(LDFLAGS)" .

.PHONY: build-frontend
build-frontend:
	cd frontend && ./build.sh

.PHONY: dev-frontend
dev-frontend:
	cd frontend && npm run dev

.PHONY: debug-image
debug-image:
	docker build -t $(IMAGE):$(GIT_TAG) \
	--build-arg GIT_TAG=$(GIT_TAG) \
	--build-arg BUILD_TIME=$(BUILD_TIME) \
	-f Dockerfile --target runner --push .
