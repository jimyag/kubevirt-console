FROM alpine:latest

WORKDIR /app

# The binary already contains the embedded UI assets
COPY kubevirt-dashboard /app/kubevirt-dashboard

ENTRYPOINT ["/app/kubevirt-dashboard"]
