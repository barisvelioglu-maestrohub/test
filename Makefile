.PHONY: help build run test clean docker-build docker-run migrate

# Variables
BINARY_NAME=license-server
DOCKER_IMAGE=license-server:latest
GO_FILES=$(shell find . -name '*.go' -type f)

# Default target
help: ## Show this help message
	@echo "Usage: make [target]"
	@echo ""
	@echo "Available targets:"
	@awk 'BEGIN {FS = ":.*##"; printf "\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  %-15s %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

build: ## Build the binary
	@echo "Building $(BINARY_NAME)..."
	@go build -o $(BINARY_NAME) cmd/server/main.go
	@echo "Build complete: $(BINARY_NAME)"

run: ## Run the application
	@echo "Running $(BINARY_NAME)..."
	@go run cmd/server/main.go

dev: ## Run in development mode with hot reload (requires air)
	@if command -v air > /dev/null; then \
		air; \
	else \
		echo "Please install air: go install github.com/cosmtrek/air@latest"; \
		exit 1; \
	fi

test: ## Run tests
	@echo "Running tests..."
	@go test -v -race -coverprofile=coverage.out ./...
	@echo "Tests complete"

test-coverage: test ## Run tests with coverage report
	@echo "Generating coverage report..."
	@go tool cover -html=coverage.out -o coverage.html
	@echo "Coverage report generated: coverage.html"

benchmark: ## Run benchmarks
	@echo "Running benchmarks..."
	@go test -bench=. -benchmem ./...

lint: ## Run linter (requires golangci-lint)
	@if command -v golangci-lint > /dev/null; then \
		golangci-lint run; \
	else \
		echo "Please install golangci-lint: https://golangci-lint.run/usage/install/"; \
		exit 1; \
	fi

fmt: ## Format code
	@echo "Formatting code..."
	@go fmt ./...
	@go mod tidy
	@echo "Code formatted"

vet: ## Run go vet
	@echo "Running go vet..."
	@go vet ./...
	@echo "Vet complete"

clean: ## Clean build artifacts
	@echo "Cleaning..."
	@rm -f $(BINARY_NAME)
	@rm -f coverage.out coverage.html
	@rm -f license.db
	@echo "Clean complete"

deps: ## Download dependencies
	@echo "Downloading dependencies..."
	@go mod download
	@echo "Dependencies downloaded"

update-deps: ## Update dependencies
	@echo "Updating dependencies..."
	@go get -u ./...
	@go mod tidy
	@echo "Dependencies updated"

docker-build: ## Build Docker image
	@echo "Building Docker image..."
	@docker build -t $(DOCKER_IMAGE) .
	@echo "Docker image built: $(DOCKER_IMAGE)"

docker-run: ## Run with docker-compose
	@echo "Starting with docker-compose..."
	@docker-compose up

docker-down: ## Stop docker-compose
	@echo "Stopping docker-compose..."
	@docker-compose down

migrate-up: ## Run database migrations up
	@echo "Running migrations..."
	@go run cmd/server/main.go -migrate-only
	@echo "Migrations complete"

generate-key: ## Generate new signing key pair
	@echo "Generating new Ed25519 key pair..."
	@go run scripts/generate_key.go
	@echo "Key pair generated"

seed: ## Seed database with sample data
	@echo "Seeding database..."
	@go run scripts/seed.go
	@echo "Database seeded"

api-docs: ## Generate API documentation
	@echo "Generating API documentation..."
	@if command -v swag > /dev/null; then \
		swag init -g cmd/server/main.go; \
	else \
		echo "Please install swag: go install github.com/swaggo/swag/cmd/swag@latest"; \
		exit 1; \
	fi

install: build ## Install binary to $GOPATH/bin
	@echo "Installing $(BINARY_NAME) to $(GOPATH)/bin..."
	@go install cmd/server/main.go
	@echo "Installation complete"

uninstall: ## Remove binary from $GOPATH/bin
	@echo "Removing $(BINARY_NAME) from $(GOPATH)/bin..."
	@rm -f $(GOPATH)/bin/$(BINARY_NAME)
	@echo "Uninstall complete"

.DEFAULT_GOAL := help