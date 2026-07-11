SHELL := /bin/bash

.PHONY: dev build deploy test

dev:
	npm run dev

build:
	npm run build:app

deploy:
	npm run deploy

test:
	npm run typecheck && npm run test
