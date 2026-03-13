# Stage 1: Build Frontend
FROM oven/bun:latest AS ui-builder
WORKDIR /app/dashboard/ui
COPY dashboard/ui/package.json dashboard/ui/bun.lock ./
RUN bun install --frozen-lockfile
COPY dashboard/ui/ .
RUN bun run build

# Stage 2: Build Backend
FROM golang:1.25-alpine AS builder
WORKDIR /app
ARG GIT_TAG
ARG BUILD_TIME

# Copy Go mod files first for better caching
COPY go.mod go.sum ./
RUN go mod download

# Copy the entire source and the built UI
COPY . .
COPY --from=ui-builder /app/dashboard/ui/dist ./dashboard/ui/dist

RUN CGO_ENABLED=0 go build -trimpath -v -ldflags "-s -w \
	-X github.com/jimmicro/version.GitTag=${GIT_TAG} \
	-X github.com/jimmicro/version.BuildTime=${BUILD_TIME}" -o /go/bin/kubevirt-dashboard .

# Stage 3: Runner
FROM alpine:latest AS runner
WORKDIR /app
COPY --from=builder /go/bin/kubevirt-dashboard /app/kubevirt-dashboard
ENTRYPOINT ["/app/kubevirt-dashboard"]
