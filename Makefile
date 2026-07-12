SHELL := /bin/bash

.PHONY: dev build deploy deploy-staging deploy-production test infra-init infra-plan infra-apply

dev:
	npm run dev

build:
	npm run build:app

deploy:
	npm run deploy

deploy-staging:
	npm run deploy:staging

deploy-production:
	npm run deploy:production

test:
	npm run typecheck && npm run test

infra-init:
	npm run infra:init

infra-plan:
	npm run infra:plan -- staging

infra-apply:
	npm run infra:apply -- staging
