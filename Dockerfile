# Frontend build stage
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy frontend dependency manifests
COPY frontend/package*.json ./
RUN npm ci --only=production

# Copy frontend source and build assets
COPY frontend/ ./
RUN npm run build

# Go backend build stage
FROM golang:alpine AS go-builder

WORKDIR /app

ARG GIT_TAG
ARG BUILD_TIME

# Copy Go module manifests
COPY go.mod go.sum ./
RUN go mod download

# Copy built frontend assets
COPY --from=frontend-builder /app/dist ./web

# Copy Go sources and build binary
COPY . .
RUN --mount=type=cache,target=/go/pkg/mod/ \
    --mount=type=cache,target="/root/.cache/go-build" \
    CGO_ENABLED=0 go build -trimpath -v -ldflags "-s -w \
	-X github.com/jimmicro/version.GitTag=${GIT_TAG} \
	-X github.com/jimmicro/version.BuildTime=${BUILD_TIME}" -o /go/bin/kubevirt-console .

FROM alpine:latest AS runner

WORKDIR /app

COPY --from=builder /go/bin/kubevirt-console /app/kubevirt-console

ENTRYPOINT ["/app/kubevirt-console"]
