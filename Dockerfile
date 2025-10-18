FROM golang:alpine AS builder

WORKDIR /app

ARG GIT_TAG
ARG BUILD_TIME

RUN --mount=type=cache,target=/go/pkg/mod/ \
    --mount=type=cache,target="/root/.cache/go-build" \
    --mount=type=bind,target=. \
    CGO_ENABLED=0 go build -trimpath -v -ldflags "-s -w \
	-X github.com/jimmicro/version.GitTag=${GIT_TAG} \
	-X github.com/jimmicro/version.BuildTime=${BUILD_TIME}" -o /go/bin/kubevirt-console .

FROM alpine:latest AS runner

WORKDIR /app

COPY --from=builder /go/bin/kubevirt-console /app/kubevirt-console

ENTRYPOINT ["/app/kubevirt-console"]