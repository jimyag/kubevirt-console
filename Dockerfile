# 前端构建阶段
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

# 复制前端依赖文件
COPY frontend/package*.json ./
RUN npm ci --only=production

# 复制前端源码并构建
COPY frontend/ ./
RUN npm run build

# Go 后端构建阶段
FROM golang:alpine AS go-builder

WORKDIR /app

ARG GIT_TAG
ARG BUILD_TIME

# 复制 Go 模块文件
COPY go.mod go.sum ./
RUN go mod download

# 复制前端构建产物
COPY --from=frontend-builder /app/dist ./web

# 复制 Go 源码并构建
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