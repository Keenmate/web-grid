# Web-Grid Workspace - Makefile
# Development and build commands for the web-grid library (workspace version)

# === Configuration ===
# Use cmd.exe on Windows to avoid path mangling issues with npm
ifeq ($(OS),Windows_NT)
SHELL := cmd.exe
.SHELLFLAGS := /c
endif

.PHONY: setup dev build package create-link unlink publish publish-rc publish-dry test-e2e test-e2e-ui test-e2e-headed clean help

# Default target
help:
	@echo Web-Grid Workspace - Available Commands:
	@echo.
	@echo Development:
	@echo   setup        - Install dependencies for all workspace packages
	@echo   dev          - Start development server (docs with HMR)
	@echo   build        - Build production version (library + docs)
	@echo   package      - Package the library for publishing
	@echo   create-link  - Create global npm link for @keenmate/web-grid
	@echo   unlink       - Remove global npm link for @keenmate/web-grid
	@echo.
	@echo Publishing:
	@echo   publish        - Publish stable version to npm (latest tag)
	@echo   publish-rc     - Publish RC/prerelease version to npm (rc tag)
	@echo   publish-dry    - Dry run publish (show what would be published)
	@echo.
	@echo Testing:
	@echo   test-e2e       - Run Playwright e2e tests (headless)
	@echo   test-e2e-ui    - Run Playwright e2e tests in UI mode
	@echo   test-e2e-headed - Run Playwright e2e tests headed
	@echo.
	@echo Cleanup:
	@echo   clean          - Clean build artifacts

setup:
	@echo Installing workspace dependencies...
	npm install
	@echo.
	@echo Setup complete!

dev:
	@echo Starting development server with HMR...
	npm run dev

build:
	@echo Building library and documentation...
	npm run build -w @keenmate/web-grid
	npm run build -w docs

package:
	@echo.
	@echo Cleaning previous dist folder...
ifeq ($(OS),Windows_NT)
	-rd /s /q packages\web-grid\dist 2>nul
else
	rm -rf packages/web-grid/dist
endif
	@echo Building library package...
	cd packages/web-grid && npm run build
	@echo Copying README and ai docs to package...
ifeq ($(OS),Windows_NT)
	copy README.md packages\web-grid\README.md >nul
	xcopy ai packages\web-grid\ai\ /s /e /y /q >nul
else
	cp README.md packages/web-grid/README.md
	cp -r ai packages/web-grid/ai
endif
	@echo.
	@echo Package built successfully
	@echo.

create-link: package
	@echo.
	@echo Creating global npm link for @keenmate/web-grid...
	cd packages/web-grid && npm link
	@echo.
	@echo Link created successfully!
	@echo To use in your project, run: npm link @keenmate/web-grid
	@echo.

unlink:
	@echo.
	@echo Removing global npm link for @keenmate/web-grid...
	cd packages/web-grid && npm unlink
	@echo.
	@echo Link removed successfully!
	@echo.

publish: package
	@echo.
	@echo Publishing to npm...
	@echo.
	cd packages/web-grid && npm publish --access public
	@echo.
	@echo Published successfully!

publish-rc: package
	@echo.
	@echo Publishing RC version to npm...
	@echo.
	cd packages/web-grid && npm publish --access public --tag rc
	@echo.
	@echo Published successfully with tag 'rc'!

publish-dry: package
	@echo Dry run - showing what would be published...
	cd packages/web-grid && npm publish --dry-run --tag rc

test-e2e: ## Run Playwright e2e tests (headless)
	npm run test:e2e

test-e2e-ui: ## Run Playwright e2e tests in UI mode
	npm run test:e2e:ui

test-e2e-headed: ## Run Playwright e2e tests headed
	npm run test:e2e:headed

clean:
	@echo Cleaning build artifacts...
ifeq ($(OS),Windows_NT)
	-rd /s /q packages\web-grid\dist 2>nul
	-rd /s /q packages\web-grid\ai 2>nul
	-rd /s /q packages\web-grid\node_modules\.vite 2>nul
	-rd /s /q docs\build 2>nul
else
	rm -rf packages/web-grid/dist packages/web-grid/ai packages/web-grid/node_modules/.vite
	rm -rf docs/build
endif
	@echo Cleaned build artifacts
