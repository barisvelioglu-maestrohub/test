# Build stage
FROM golang:1.21-alpine AS builder

RUN apk add --no-cache git gcc musl-dev sqlite-dev

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=1 GOOS=linux go build -a -installsuffix cgo -o license-server cmd/server/main.go

# Final stage
FROM alpine:latest

RUN apk --no-cache add ca-certificates sqlite

WORKDIR /root/

COPY --from=builder /app/license-server .
COPY --from=builder /app/config.yaml .

EXPOSE 8080

CMD ["./license-server"]